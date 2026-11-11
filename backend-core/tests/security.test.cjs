const { before, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

process.env.JWT_SECRET = 'unit-test-jwt-secret';

let security;
let scopeService;
let scopeMiddleware;
let authMiddleware;
let authController;
let facultyController;
let facultyReportsController;
let studentScope;
let questionBankPolicy;
let questionBankController;
let quizController;
let questionPaperController;
let pollController;
let studentDashboardController;
let facultyDashboardController;
let prisma;
before(() => {
  security = require('../dist/utils/faculty-security');
  scopeService = require('../dist/services/faculty-scope.service');
  scopeMiddleware = require('../dist/middlewares/faculty-scope.middleware');
  authMiddleware = require('../dist/middlewares/auth.middleware');
  authController = require('../dist/controllers/auth.controller');
  facultyController = require('../dist/controllers/faculty.controller');
  facultyReportsController = require('../dist/controllers/faculty-reports.controller');
  studentScope = require('../dist/utils/faculty-student-scope');
  questionBankPolicy = require('../dist/utils/question-bank-policy');
  questionBankController = require('../dist/controllers/question-bank.controller');
  quizController = require('../dist/controllers/quiz.controller');
  questionPaperController = require('../dist/controllers/question-paper.controller');
  pollController = require('../dist/controllers/announcement-poll.controller');
  studentDashboardController = require('../dist/controllers/student-dashboard.controller');
  facultyDashboardController = require('../dist/controllers/faculty-dashboard.controller');
  prisma = require('../dist/config/prisma').prisma;
});

describe('faculty question bank', () => {
  const validPayload = (type, values = {}) => ({
    category: 'ASSIGNMENT', type, text: 'Question text', marks: 2, negativeMarks: 0,
    options: undefined, answerKey: undefined, ...values,
  });

  it('supports every existing question type with its required answer structure', () => {
    const samples = [
      validPayload('MCQ', { options: ['A', 'B'], answerKey: 'A' }),
      validPayload('MULTI_SELECT', { options: ['A', 'B'], answerKey: ['A', 'B'] }),
      validPayload('NUMERICAL', { answerKey: 42 }),
      validPayload('SHORT_WRITTEN'),
      validPayload('LONG_WRITTEN'),
      validPayload('MATCHING', { options: [{ left: 'A', right: '1' }], answerKey: [{ left: 'A', right: '1' }] }),
      validPayload('TRUE_FALSE', { answerKey: true }),
      validPayload('FILL_BLANK', { answerKey: 'answer' }),
      validPayload('CODING', { answerKey: 'return 42;' }),
    ];
    assert.equal(samples.length, 9);
    samples.forEach((sample) => assert.equal(questionBankPolicy.validateQuestionBankPayload(sample).type, sample.type));
  });

  it('rejects invalid answer structures and image references', () => {
    assert.throws(() => questionBankPolicy.validateQuestionBankPayload(validPayload('MCQ', { options: ['A', 'B'], answerKey: 'C' })), { errorCode: 'ERR_INVALID_QUESTION_ANSWER' });
    assert.throws(() => questionBankPolicy.validateQuestionBankPayload(validPayload('MATCHING', { options: [{ left: 'A', right: '' }], answerKey: [] })), { errorCode: 'ERR_INVALID_QUESTION_OPTIONS' });
    assert.throws(() => questionBankPolicy.validateQuestionBankPayload(validPayload('TRUE_FALSE', { answerKey: 'yes' })), { errorCode: 'ERR_INVALID_QUESTION_ANSWER' });
    assert.throws(() => questionBankPolicy.validateQuestionBankPayload(validPayload('MCQ', { options: ['A', 'B'], answerKey: 'A', image: 'https://evil.example/image.png' })), { errorCode: 'ERR_INVALID_QUESTION_IMAGE' });
  });

  it('filters categories and metadata and excludes opposite-category use unless explicitly included', () => {
    const filters = questionBankPolicy.parseQuestionBankFilters({ category: 'TEST_QUIZ', type: 'MATCHING', subject: 'Math', topic: 'Fractions', difficulty: 'Hard', tag: 'exam', search: 'pair', page: '2', limit: '500' });
    assert.equal(filters.limit, 100);
    const where = questionBankPolicy.buildQuestionBankWhere(filters, 'faculty-1');
    assert.deepEqual(where.AND[1], { category: 'TEST_QUIZ' });
    assert.deepEqual(where.AND[2].OR.slice(0, 2), [{ ownerId: 'faculty-1' }, { ownerId: null }]);
    assert.deepEqual(where.AND[2].OR[2], { owner: { is: { role: 'ADMIN' } } });
    assert.ok(where.AND.some((item) => item.usages?.none?.category?.not === 'TEST_QUIZ'));
    const includeReused = questionBankPolicy.buildQuestionBankWhere({ ...filters, includeReused: true }, 'faculty-1');
    assert.ok(!includeReused.AND.some((item) => item.usages));
    assert.deepEqual(questionBankPolicy.questionReuseStatus([{ category: 'ASSIGNMENT', assessmentTitle: 'A1' }], 'TEST_QUIZ'), {
      eligible: false, usedInOppositeCategory: true, warning: 'This question has been used in the opposite assessment category.',
    });
  });

  it('validates image MIME, extension and the upload size limit', () => {
    assert.equal(questionBankPolicy.isAllowedQuestionImage('image/png', 'diagram.png'), true);
    assert.equal(questionBankPolicy.isAllowedQuestionImage('image/jpeg', 'diagram.png'), false);
    assert.equal(questionBankPolicy.isAllowedQuestionImage('image/svg+xml', 'diagram.svg'), false);
    assert.equal(questionBankPolicy.QUESTION_IMAGE_MAX_BYTES, 5 * 1024 * 1024);
  });

  it('creates questions under the authenticated owner and ignores supplied ownership', async () => {
    const originalCreate = prisma.question.create;
    let captured;
    prisma.question.create = async (args) => { captured = args; return { ...args.data, id: 'q1', owner: { id: 'faculty-1', name: 'F' }, usages: [] }; };
    try {
      const error = await invokeController(questionBankController.createBankQuestion, {
        user: { userId: 'faculty-1', role: 'FACULTY' },
        body: { ...validPayload('MCQ', { options: ['A', 'B'], answerKey: 'A', tags: ['algebra'] }), ownerId: 'victim-faculty' },
      });
      assert.equal(error, undefined);
      assert.equal(captured.data.ownerId, 'faculty-1');
      assert.deepEqual(captured.data.tags, ['algebra']);
    } finally { prisma.question.create = originalCreate; }
  });

  it('lists paginated questions with server-side category, search and tag filters', async () => {
    const originalCount = prisma.question.count;
    const originalFindMany = prisma.question.findMany;
    let countArgs;
    let findArgs;
    prisma.question.count = async (args) => { countArgs = args; return 21; };
    prisma.question.findMany = async (args) => { findArgs = args; return []; };
    try {
      let response;
      const req = { user: { userId: 'faculty-1', role: 'FACULTY' }, query: { category: 'TEST_QUIZ', search: 'integral', type: 'MATCHING', tag: 'exam', page: '2', limit: '10' } };
      await questionBankController.listQuestionBank(req, { status() { return this; }, json(body) { response = body; return this; } }, (error) => { throw error; });
      assert.equal(countArgs.where, findArgs.where);
      assert.equal(findArgs.skip, 10);
      assert.equal(findArgs.take, 10);
      assert.ok(findArgs.where.AND.some((item) => item.category === 'TEST_QUIZ'));
      assert.ok(findArgs.where.AND.some((item) => item.type === 'MATCHING'));
      assert.deepEqual(response.data.pagination, { page: 2, limit: 10, total: 21, pages: 3 });
    } finally { prisma.question.count = originalCount; prisma.question.findMany = originalFindMany; }
  });

  it('allows the owner to edit their question while preserving ownership', async () => {
    const originalFindFirst = prisma.question.findFirst;
    const originalUpdate = prisma.question.update;
    let captured;
    prisma.question.findFirst = async () => ({ id: 'q1', ownerId: 'faculty-1', category: 'ASSIGNMENT' });
    prisma.question.update = async (args) => { captured = args; return { ...args.data, id: 'q1', ownerId: 'faculty-1', usages: [], owner: { id: 'faculty-1', name: 'Faculty' } }; };
    try {
      const error = await invokeController(questionBankController.updateBankQuestion, {
        user: { userId: 'faculty-1', role: 'FACULTY' }, params: { questionId: 'q1' },
        body: validPayload('MCQ', { options: ['A', 'B'], answerKey: 'B', text: 'Updated question' }),
      });
      assert.equal(error, undefined);
      assert.equal(captured.data.text, 'Updated question');
      assert.equal(captured.data.ownerId, undefined);
    } finally { prisma.question.findFirst = originalFindFirst; prisma.question.update = originalUpdate; }
  });

  it('prevents editing another faculty member’s private question', async () => {
    const originalFindFirst = prisma.question.findFirst;
    const originalUpdate = prisma.question.update;
    prisma.question.findFirst = async () => ({ id: 'q-other', ownerId: 'faculty-2', category: 'ASSIGNMENT' });
    prisma.question.update = async () => { throw new Error('Unauthorized edit must not write'); };
    try {
      const error = await invokeController(questionBankController.updateBankQuestion, {
        user: { userId: 'faculty-1', role: 'FACULTY' }, params: { questionId: 'q-other' },
        body: validPayload('MCQ', { options: ['A', 'B'], answerKey: 'A' }),
      });
      assert.equal(error.errorCode, 'ERR_QUESTION_NOT_OWNED');
    } finally { prisma.question.findFirst = originalFindFirst; prisma.question.update = originalUpdate; }
  });

  it('archives an owned question instead of deleting assessment response history', async () => {
    const originalFindFirst = prisma.question.findFirst;
    const originalUpdate = prisma.question.update;
    const originalDelete = prisma.question.delete;
    let updateData;
    prisma.question.findFirst = async () => ({ id: 'q1', ownerId: 'faculty-1' });
    prisma.question.update = async (args) => { updateData = args.data; return {}; };
    prisma.question.delete = async () => { throw new Error('Question records must not be physically deleted by bank delete.'); };
    try {
      const error = await invokeController(questionBankController.archiveBankQuestion, { user: { userId: 'faculty-1', role: 'FACULTY' }, params: { questionId: 'q1' } });
      assert.equal(error, undefined);
      assert.ok(updateData.archivedAt instanceof Date);
    } finally { prisma.question.findFirst = originalFindFirst; prisma.question.update = originalUpdate; prisma.question.delete = originalDelete; }
  });

  it('records question-to-quiz usage and owner when quiz questions are saved', async () => {
    const originalFindUnique = prisma.quiz.findUnique;
    const originalQuestionCreate = prisma.question.create;
    const originalTransaction = prisma.$transaction;
    const created = [];
    prisma.quiz.findUnique = async () => ({ id: 'quiz-1', title: 'Quiz One', subject: 'Math', createdBy: 'faculty-1' });
    prisma.question.create = (args) => { created.push(args.data); return Promise.resolve({ id: `q${created.length}` }); };
    prisma.$transaction = async (ops) => Promise.all(ops);
    try {
      const error = await invokeController(quizController.addQuestions, {
        user: { userId: 'faculty-1', role: 'FACULTY' }, params: { quizId: 'quiz-1' },
        body: { questions: [{ type: 'MCQ', text: 'Question', marks: 1, options: ['A', 'B'], answerKey: 'A' }] },
      });
      assert.equal(error, undefined);
      assert.equal(created[0].ownerId, 'faculty-1');
      assert.equal(created[0].category, 'TEST_QUIZ');
      assert.deepEqual(created[0].usages.create, { category: 'TEST_QUIZ', quizId: 'quiz-1', assessmentTitle: 'Quiz One', marks: 1, sortOrder: 0 });
    } finally { prisma.quiz.findUnique = originalFindUnique; prisma.question.create = originalQuestionCreate; prisma.$transaction = originalTransaction; }
  });

  it('keeps bank-question links detached when an assessment is deleted', async () => {
    const originalFindUnique = prisma.quiz.findUnique;
    const originalQuizDelete = prisma.quiz.delete;
    const originalQuestionDelete = prisma.question.delete;
    let deletedQuiz = false;
    prisma.quiz.findUnique = async () => ({ id: 'quiz-1', createdBy: 'faculty-1' });
    prisma.quiz.delete = async () => { deletedQuiz = true; return {}; };
    prisma.question.delete = async () => { throw new Error('Deleting an assessment must not delete its question-bank records.'); };
    try {
      const error = await invokeController(quizController.deleteQuiz, { user: { userId: 'faculty-1', role: 'FACULTY' }, params: { quizId: 'quiz-1' } });
      assert.equal(error, undefined);
      assert.equal(deletedQuiz, true);
    } finally { prisma.quiz.findUnique = originalFindUnique; prisma.quiz.delete = originalQuizDelete; prisma.question.delete = originalQuestionDelete; }
    const migration = fs.readFileSync(path.join(__dirname, '..', 'prisma', 'migrations', '20261109090000_question_bank', 'migration.sql'), 'utf8');
    assert.match(migration, /Question_quizId_fkey.*ON DELETE SET NULL/s);
    assert.match(migration, /QuestionUsage_quizId_fkey.*ON DELETE SET NULL/s);
  });
});

describe('question paper class publishing authorization', () => {
  it('rejects publishing to a class outside the authenticated faculty scope', async () => {
    const originalFindFirst = prisma.quiz.findFirst;
    const originalUpdate = prisma.quiz.update;
    prisma.quiz.findFirst = async () => ({
      id: 'paper-1', createdBy: 'faculty-1', paperCategory: 'TEST_QUIZ', paperStatus: 'READY',
      questionUsages: [{ questionId: 'q1', marks: 2 }], questions: [],
      targetDepartments: [], targetSections: [{ sectionId: 'section-outside' }],
    });
    prisma.quiz.update = async () => { throw new Error('An unauthorized paper must not be published.'); };
    try {
      const error = await invokeController(questionPaperController.publishQuestionPaper, {
        user: { userId: 'faculty-1', role: 'FACULTY' }, facultyScope: { departmentIds: ['department-1'], sectionIds: ['section-authorized'] }, params: { paperId: 'paper-1' },
      });
      assert.equal(error.errorCode, 'ERR_PAPER_CLASS_FORBIDDEN');
    } finally { prisma.quiz.findFirst = originalFindFirst; prisma.quiz.update = originalUpdate; }
  });
});

describe('announcement poll authorization and results', () => {
  it('persists a poll for an authorized faculty department with options and schedule', async () => {
    const originalDepartmentFind = prisma.department.findUnique;
    const originalCreate = prisma.announcement.create;
    let saved;
    prisma.department.findUnique = async () => ({ id: 'dept-1', name: 'CSE', batch: { name: '2026' } });
    prisma.announcement.create = async ({ data }) => { saved = data; return data; };
    try {
      const error = await invokeController(pollController.createPoll, {
        user: { userId: 'faculty-1', role: 'FACULTY' }, facultyScope: { facultyId: 'faculty-1', departmentIds: ['dept-1'], sectionIds: [], classes: [], studentIds: [] },
        body: { question: 'Preferred time?', options: ['Morning', 'Evening'], targetType: 'DEPARTMENT', targetId: 'dept-1', startsAt: '2026-11-10T09:00:00Z', expiresAt: '2026-11-12T09:00:00Z' },
      });
      assert.equal(error, undefined);
      assert.equal(saved.isPoll, true); assert.equal(saved.facultyId, 'faculty-1');
      assert.deepEqual(saved.pollOptions, ['Morning', 'Evening']); assert.equal(saved.pollTargetId, 'dept-1');
    } finally { prisma.department.findUnique = originalDepartmentFind; prisma.announcement.create = originalCreate; }
  });

  it('rejects a poll target outside faculty scope before persistence', async () => {
    const originalDepartmentFind = prisma.department.findUnique;
    const originalCreate = prisma.announcement.create;
    prisma.department.findUnique = async () => ({ id: 'dept-outside', name: 'ECE', batch: { name: '2026' } });
    prisma.announcement.create = async () => { throw new Error('Poll must not be created outside scope.'); };
    try {
      const error = await invokeController(pollController.createPoll, {
        user: { userId: 'faculty-1', role: 'FACULTY' }, facultyScope: { facultyId: 'faculty-1', departmentIds: ['dept-1'], sectionIds: [], classes: [], studentIds: [] },
        body: { question: 'Preferred time?', options: ['Morning', 'Evening'], targetType: 'DEPARTMENT', targetId: 'dept-outside' },
      });
      assert.equal(error.errorCode, 'ERR_POLL_TARGET_FORBIDDEN');
    } finally { prisma.department.findUnique = originalDepartmentFind; prisma.announcement.create = originalCreate; }
  });

  it('scopes poll lists and results to the authenticated faculty', async () => {
    const originalMany = prisma.announcement.findMany;
    const originalFirst = prisma.announcement.findFirst;
    const originalResponses = prisma.announcementResponse.findMany;
    let listWhere; let resultWhere; let emptyResults = false;
    prisma.announcement.findMany = async ({ where }) => { listWhere = where; return []; };
    prisma.announcement.findFirst = async ({ where }) => { resultWhere = where; return { id: 'poll-1', facultyId: 'faculty-1', pollOptions: ['A', 'B'] }; };
    prisma.announcementResponse.findMany = async () => emptyResults ? [] : [{ response: 'A' }, { response: 'A' }, { response: 'B' }];
    try {
      const req = { user: { userId: 'faculty-1', role: 'FACULTY' }, query: { status: 'ALL' }, params: { id: 'poll-1' } };
      await invokeController(pollController.listPolls, req);
      assert.equal(listWhere.facultyId, 'faculty-1');
      let payload;
      await pollController.getPollResults(req, { json(value) { payload = value; return this; } }, (error) => { throw error; });
      assert.equal(resultWhere.facultyId, 'faculty-1');
      assert.equal(payload.data.total, 3); assert.deepEqual(payload.data.options.map((option) => option.count), [2, 1]);
      assert.deepEqual(payload.data.options.map((option) => option.percentage), [66.7, 33.3]);
      emptyResults = true;
      await pollController.getPollResults(req, { json(value) { payload = value; return this; } }, (error) => { throw error; });
      assert.deepEqual(payload.data.options.map((option) => option.percentage), [null, null]);
    } finally { prisma.announcement.findMany = originalMany; prisma.announcement.findFirst = originalFirst; prisma.announcementResponse.findMany = originalResponses; }
  });

  it('persists a student poll response once and rejects duplicate votes', async () => {
    const originalAnnouncement = prisma.announcement.findUnique;
    const originalUser = prisma.user.findUnique;
    const originalResponseFind = prisma.announcementResponse.findUnique;
    const originalResponseCreate = prisma.announcementResponse.create;
    const originalNotificationCreate = prisma.notification.create;
    let created = 0;
    let studentDepartmentId = 'dept-other';
    prisma.announcement.findUnique = async () => ({ id: 'poll-1', title: 'Preferred time?', facultyId: 'faculty-1', isSurvey: true, isPoll: true, pollOptions: ['Morning', 'Evening'], pollStartsAt: new Date(Date.now() - 10000), pollExpiresAt: null, pollAudienceType: 'DEPARTMENT', pollTargetId: 'dept-1' });
    prisma.user.findUnique = async () => ({ name: 'Student', rollNumber: 'R1', department: { batchId: 'batch-1' }, departmentId: studentDepartmentId, sectionId: null });
    prisma.announcementResponse.findUnique = async () => created ? { id: 'response-1' } : null;
    prisma.announcementResponse.create = async (args) => { created += 1; return { id: 'response-1', ...args.data }; };
    prisma.notification.create = async () => ({});
    try {
      const request = { user: { userId: 'student-1', role: 'STUDENT' }, body: { announcementId: 'poll-1', response: 'Morning' } };
      const call = async () => { let statusCode = 200; let payload; await studentDashboardController.submitAnnouncementResponse(request, { status(code) { statusCode = code; return this; }, json(body) { payload = body; return this; } }); return { statusCode, payload }; };
      assert.equal((await call()).statusCode, 403);
      studentDepartmentId = 'dept-1';
      assert.equal((await call()).statusCode, 200);
      assert.equal((await call()).statusCode, 409);
      assert.equal(created, 1);
    } finally { prisma.announcement.findUnique = originalAnnouncement; prisma.user.findUnique = originalUser; prisma.announcementResponse.findUnique = originalResponseFind; prisma.announcementResponse.create = originalResponseCreate; prisma.notification.create = originalNotificationCreate; }
  });
});

describe('faculty notification access', () => {
  it('lists only the authenticated faculty member notifications', async () => {
    const original = prisma.notification.findMany;
    let query;
    prisma.notification.findMany = async (args) => { query = args; return []; };
    try {
      await invokeController(facultyDashboardController.getNotifications, { user: { userId: 'faculty-1', role: 'FACULTY' } });
      assert.deepEqual(query.where, { facultyId: 'faculty-1' });
      assert.equal(query.take, 50);
    } finally { prisma.notification.findMany = original; }
  });

  it('rejects marking another faculty member notification read and guards both routes by faculty role', async () => {
    const originalFind = prisma.notification.findUnique;
    const originalUpdate = prisma.notification.update;
    prisma.notification.findUnique = async () => ({ id: 'n1', facultyId: 'faculty-other' });
    prisma.notification.update = async () => { throw new Error('Foreign notification cannot be updated.'); };
    try {
      let statusCode = 200;
      await facultyDashboardController.markNotificationRead({ user: { userId: 'faculty-1', role: 'FACULTY' }, params: { id: 'n1' } }, { status(code) { statusCode = code; return this; }, json() { return this; } });
      assert.equal(statusCode, 403);
      const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/faculty-dashboard.routes.ts'), 'utf8');
      assert.match(routeSource, /router\.get\('\/notifications', authenticate, authorize\(\['FACULTY', 'ADMIN'\]\)/);
      assert.match(routeSource, /router\.patch\('\/notifications\/:id\/read', authenticate, authorize\(\['FACULTY', 'ADMIN'\]\)/);
      let guardError;
      authMiddleware.authorize(['FACULTY', 'ADMIN'])({ user: { userId: 'student-1', role: 'STUDENT' } }, {}, (error) => { guardError = error; });
      assert.equal(guardError.errorCode, 'ERR_FORBIDDEN');
    } finally { prisma.notification.findUnique = originalFind; prisma.notification.update = originalUpdate; }
  });
});

const invokeController = async (controller, req) => {
  let caught;
  await controller(req, { status() { return this; }, json() { return this; } }, (error) => { caught = error; });
  return caught;
};

describe('faculty email security', () => {
  it('accepts, trims and lowercases an exact institutional email', () => {
    assert.equal(security.normalizeFacultyEmail('  Faculty@CH.AMRITA.EDU '), 'faculty@ch.amrita.edu');
  });

  it('rejects malformed, external, and lookalike domains', () => {
    for (const email of ['not-email', 'faculty@gmail.com', 'faculty@amrita.edu', 'faculty@evilch.amrita.edu', 'faculty@ch-amrita.edu', 'faculty@sub.ch.amrita.edu']) {
      assert.throws(() => security.normalizeFacultyEmail(email), { errorCode: 'ERR_FACULTY_EMAIL_DOMAIN' });
    }
  });

  it('returns the API validation error for malformed addresses', async () => {
    const error = await invokeController(authController.register, {
      body: { role: 'FACULTY', name: 'Faculty', email: 'not-an-email', personalEmail: 'person@gmail.com', password: 'Password123', employeeId: 'F1', subject: 'Math' },
    });
    assert.equal(error.name, 'ZodError');
  });

  it('rejects invalid domain on direct email registration API requests', async () => {
    const error = await invokeController(authController.register, {
      body: { role: 'FACULTY', name: 'Faculty', email: 'faculty@amrita.edu', personalEmail: 'person@gmail.com', password: 'Password123', employeeId: 'F1', subject: 'Math' },
    });
    assert.equal(error.errorCode, 'ERR_FACULTY_EMAIL_DOMAIN');
  });

  it('rejects invalid domain on direct Firebase faculty registration API requests', async () => {
    const error = await invokeController(authController.firebaseAuthRegister, {
      body: { idToken: 'not-verified', role: 'FACULTY', name: 'Faculty', email: 'faculty@evilch.amrita.edu', employeeId: 'F1', subject: 'Math' },
    });
    assert.equal(error.errorCode, 'ERR_FACULTY_EMAIL_DOMAIN');
  });
});

describe('faculty scope', () => {
  it('derives scope from the authenticated faculty identity, not request data', async () => {
    let resolvedFor;
    const scope = { facultyId: 'token-faculty', departmentIds: ['dept-1'], sectionIds: ['section-1'], classes: [], studentIds: ['student-1'] };
    const middleware = scopeMiddleware.createAttachFacultyScope(async (facultyId) => { resolvedFor = facultyId; return scope; });
    const req = { user: { userId: 'token-faculty', role: 'FACULTY' }, body: { facultyId: 'attacker' } };
    let nextError;
    await middleware(req, {}, (error) => { nextError = error; });
    assert.equal(nextError, undefined);
    assert.equal(resolvedFor, 'token-faculty');
    assert.equal(req.facultyScope, scope);
  });

  it('returns classes and students mapped to the token faculty', async () => {
    let studentFilter;
    const db = {
      facultyDepartment: { findMany: async () => [{ department: { id: 'dept-1', batchId: 'batch-1' } }] },
      facultySection: { findMany: async () => [{ section: { id: 'section-1', departmentId: 'dept-2', department: { batchId: 'batch-2' } } }] },
      user: { findMany: async (args) => { studentFilter = args.where; return [{ id: 'student-1' }, { id: 'student-2' }]; } },
    };
    const scope = await scopeService.getFacultyScope('faculty-1', db);
    assert.deepEqual(scope.departmentIds, ['dept-1']);
    assert.deepEqual(scope.sectionIds, ['section-1']);
    assert.deepEqual(scope.classes.map(({ id, type, batchId }) => ({ id, type, batchId })), [
      { id: 'dept-1', type: 'department', batchId: 'batch-1' },
      { id: 'section-1', type: 'section', batchId: 'batch-2' },
    ]);
    assert.deepEqual(scope.studentIds, ['student-1', 'student-2']);
    assert.deepEqual(studentFilter, { role: 'STUDENT', OR: [{ departmentId: { in: ['dept-1'] } }, { sectionId: { in: ['section-1'] } }] });
  });
});

describe('assessment submission security', () => {
  it('allows a student to submit their own attempt', () => {
    assert.doesNotThrow(() => security.assertStudentOwnsAttempt({ userId: 'student-1', role: 'STUDENT' }, { userId: 'student-1' }));
  });

  it('rejects another student, faculty, AI/service roles, and missing identity', () => {
    for (const [principal, attempt] of [
      [{ userId: 'student-2', role: 'STUDENT' }, { userId: 'student-1' }],
      [{ userId: 'faculty-1', role: 'FACULTY' }, { userId: 'student-1' }],
      [{ userId: 'service-1', role: 'AI_SERVICE' }, { userId: 'student-1' }],
      [{ userId: 'service-1', role: 'SERVICE' }, { userId: 'student-1' }],
      [undefined, { userId: 'student-1' }],
    ]) {
      assert.throws(() => security.assertStudentOwnsAttempt(principal, attempt), { statusCode: 403 });
    }
  });

  it('denies non-student roles through the mounted route role guard', () => {
    const guard = authMiddleware.authorize(['STUDENT']);
    for (const role of ['FACULTY', 'AI_SERVICE', 'SERVICE']) {
      let error;
      guard({ user: { userId: `${role}-1`, role } }, {}, (nextError) => { error = nextError; });
      assert.equal(error.statusCode, 403);
    }
  });

  it('rejects missing credentials at the authentication middleware', () => {
    let error;
    authMiddleware.authenticate({ headers: {} }, {}, (nextError) => { error = nextError; });
    assert.equal(error.statusCode, 401);
  });
});

describe('faculty profile API', () => {
  it('rejects protected profile-field changes before database access', async () => {
    const error = await invokeController(facultyController.updateFacultyProfile, {
      user: { userId: 'faculty-1', role: 'FACULTY' },
      body: { name: 'Changed name', currentPassword: 'old-password', newPassword: 'NewPassword123' },
    });
    assert.equal(error.errorCode, 'ERR_FACULTY_PROFILE_LOCKED');
  });

  it('requires current and sufficiently strong new passwords', () => {
    assert.throws(() => security.parseFacultyPasswordChange({ newPassword: 'NewPassword123' }), { errorCode: 'ERR_PASSWORD_CHANGE_FIELDS' });
    assert.throws(() => security.parseFacultyPasswordChange({ currentPassword: 'old-password', newPassword: 'short' }), { errorCode: 'ERR_PASSWORD_TOO_WEAK' });
    assert.throws(() => security.parseFacultyPasswordChange({ currentPassword: 'old-password', newPassword: 'password1' }), { errorCode: 'ERR_PASSWORD_TOO_WEAK' });
    assert.throws(() => security.parseFacultyPasswordChange({ currentPassword: 'old-password', newPassword: 'Password' }), { errorCode: 'ERR_PASSWORD_TOO_WEAK' });
    assert.throws(() => security.parseFacultyPasswordChange({ currentPassword: 'old-password', newPassword: 'NewPassword123', name: 'Changed' }), { errorCode: 'ERR_FACULTY_PROFILE_LOCKED' });
    assert.deepEqual(security.parseFacultyPasswordChange({ currentPassword: 'old-password', newPassword: 'NewPassword123' }), { currentPassword: 'old-password', newPassword: 'NewPassword123' });
  });
});

describe('faculty reports and student management scope', () => {
  const scope = { facultyId: 'faculty-1', departmentIds: ['dept-1'], sectionIds: ['section-1'], classes: [], studentIds: ['student-1'] };

  it('applies Year, Department, Section and Search filters inside the assigned student set', () => {
    const where = studentScope.buildFacultyStudentWhere(scope, {
      year: 2024, departmentId: 'dept-1', sectionId: 'section-1', search: 'Alex',
    });
    assert.deepEqual(where.AND[0], { role: 'STUDENT' });
    assert.deepEqual(where.AND[1], { id: { in: ['student-1'] } });
    assert.deepEqual(where.AND[2], { department: { batch: { startYear: 2024 } } });
    assert.deepEqual(where.AND[3], { departmentId: 'dept-1' });
    assert.deepEqual(where.AND[4], { sectionId: 'section-1' });
    assert.deepEqual(where.AND[5].OR, [
      { name: { contains: 'Alex', mode: 'insensitive' } },
      { rollNumber: { contains: 'Alex', mode: 'insensitive' } },
    ]);
  });

  it('keeps directory, filter-options, report summaries and quiz analytics queries pre-scoped', async () => {
    const originalFindMany = prisma.user.findMany;
    const originalCount = prisma.user.count;
    const originalQuizFind = prisma.quiz.findUnique;
    const originalAttemptFind = prisma.quizAttempt.findMany;
    const userWheres = [];
    let attemptWhere;
    try {
      prisma.user.findMany = async (args) => { userWheres.push(args.where); return []; };
      prisma.user.count = async () => 0;
      await facultyController.getStudents({ user: { userId: 'faculty-1', role: 'FACULTY' }, facultyScope: scope, query: { year: '2024', departmentId: 'dept-1', sectionId: 'section-1', search: 'Alex' } }, { status() { return this; }, json() { return this; } }, (error) => { throw error; });
      await facultyController.getStudentFilterOptions({ user: { userId: 'faculty-1', role: 'FACULTY' }, facultyScope: scope, query: { year: '2024', departmentId: 'dept-1' } }, { status() { return this; }, json() { return this; } }, (error) => { throw error; });
      await facultyReportsController.getPerformanceBands({ user: { userId: 'faculty-1', role: 'FACULTY' }, facultyScope: scope, query: { year: '2024', departmentId: 'dept-1', sectionId: 'section-1' } }, { status() { return this; }, json() { return this; } }, (error) => { throw error; });
      prisma.quiz.findUnique = async () => ({ id: 'quiz-1', title: 'Quiz', totalMarks: 10, createdBy: 'faculty-2', targetDepartments: [], targetSections: [], targetStudents: [] });
      prisma.quizAttempt.findMany = async (args) => { attemptWhere = args.where; return []; };
      await facultyReportsController.getQuizAnalytics({ user: { userId: 'faculty-1', role: 'FACULTY' }, facultyScope: scope, params: { quizId: 'quiz-1' }, query: { year: '2024', departmentId: 'dept-1', sectionId: 'section-1' } }, { status() { return this; }, json() { return this; } }, (error) => { throw error; });
    } finally {
      prisma.user.findMany = originalFindMany;
      prisma.user.count = originalCount;
      prisma.quiz.findUnique = originalQuizFind;
      prisma.quizAttempt.findMany = originalAttemptFind;
    }
    assert.ok(userWheres.length >= 5);
    for (const where of userWheres) assert.ok(JSON.stringify(where).includes('student-1'));
    assert.ok(JSON.stringify(attemptWhere.user).includes('student-1'));
    assert.ok(JSON.stringify(attemptWhere.user).includes('section-1'));
  });

  it('filters student search and profile queries before record lookup', async () => {
    const originalFindFirst = prisma.user.findFirst;
    const captured = [];
    try {
      prisma.user.findFirst = async (args) => { captured.push(args.where); return null; };
      const nextErrors = [];
      await facultyController.searchStudent({ user: { userId: 'faculty-1', role: 'FACULTY' }, facultyScope: scope, query: { rollNumber: 'OUTSIDE', year: '2024', departmentId: 'dept-other' } }, {}, (error) => nextErrors.push(error));
      await facultyController.getStudentProfile({ user: { userId: 'faculty-1', role: 'FACULTY' }, facultyScope: scope, params: { studentId: 'student-outside' } }, {}, (error) => nextErrors.push(error));
      assert.equal(captured.length, 2);
      assert.ok(captured.every((where) => JSON.stringify(where).includes('student-1')));
      assert.equal(nextErrors.length, 2);
    } finally {
      prisma.user.findFirst = originalFindFirst;
    }
  });

  it('rejects direct password reset attempts for students outside the token faculty scope', async () => {
    const originalFindFirst = prisma.user.findFirst;
    const originalUpdate = prisma.user.update;
    let where;
    try {
      prisma.user.findFirst = async (args) => { where = args.where; return null; };
      prisma.user.update = async () => { throw new Error('Reset must not be issued for an out-of-scope student'); };
      const error = await invokeController(facultyController.resetStudentPassword, {
        user: { userId: 'faculty-1', role: 'FACULTY' }, facultyScope: scope,
        params: { studentId: 'student-outside' }, body: { facultyId: 'attacker' },
      });
      assert.equal(error.errorCode, 'ERR_STUDENT_OUT_OF_SCOPE');
      assert.ok(JSON.stringify(where).includes('student-1'));
      assert.ok(JSON.stringify(where).includes('student-outside'));
    } finally {
      prisma.user.findFirst = originalFindFirst;
      prisma.user.update = originalUpdate;
    }
  });

  it('initiates the existing reset flow for an authorized student without returning credentials', async () => {
    const originalFindFirst = prisma.user.findFirst;
    const resetModule = require('../dist/services/password-reset.service');
    const originalIssue = resetModule.issuePasswordReset;
    let resetUser;
    try {
      prisma.user.findFirst = async () => ({ id: 'student-1', role: 'STUDENT', authProvider: 'EMAIL', password: 'hashed-secret', personalEmail: 'student@example.test' });
      resetModule.issuePasswordReset = async (user) => { resetUser = user; };
      let result;
      const nextError = await facultyController.resetStudentPassword({ user: { userId: 'faculty-1', role: 'FACULTY' }, facultyScope: scope, params: { studentId: 'student-1' } }, { status() { return this; }, json(body) { result = body; return this; } }, (error) => { throw error; });
      assert.equal(nextError, undefined);
      assert.equal(resetUser.id, 'student-1');
      assert.match(result.message, /instructions were sent/i);
      assert.equal(JSON.stringify(result).includes('hashed-secret'), false);
      assert.equal(JSON.stringify(result).includes('student@example.test'), false);
    } finally {
      prisma.user.findFirst = originalFindFirst;
      resetModule.issuePasswordReset = originalIssue;
    }
  });
});
