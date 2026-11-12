const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const { prisma } = require('../dist/config/prisma');
const quizController = require('../dist/controllers/quiz.controller');
const studentExamController = require('../dist/controllers/student-exam.controller');
const studentDashboardController = require('../dist/controllers/student-dashboard.controller');
const objectStorage = require('../dist/utils/object-storage');
const questionBankPolicy = require('../dist/utils/question-bank-policy');

const originals = {
  quiz: { ...prisma.quiz },
  quizAttempt: { ...prisma.quizAttempt },
  quizResponse: { ...prisma.quizResponse },
  question: { ...prisma.question },
  user: { ...prisma.user },
  assignmentSubmission: prisma.assignmentSubmission ? { ...prisma.assignmentSubmission } : null,
  $transaction: prisma.$transaction,
};

function restoreMocks() {
  Object.assign(prisma.quiz, originals.quiz);
  Object.assign(prisma.quizAttempt, originals.quizAttempt);
  Object.assign(prisma.quizResponse, originals.quizResponse);
  Object.assign(prisma.question, originals.question);
  Object.assign(prisma.user, originals.user);
  if (originals.assignmentSubmission && prisma.assignmentSubmission) {
    Object.assign(prisma.assignmentSubmission, originals.assignmentSubmission);
  }
  prisma.$transaction = originals.$transaction;
}

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

async function runHandler(handler, req) {
  const res = createRes();
  let nextErr = null;
  await handler(req, res, (err) => {
    if (err) nextErr = err;
  });
  return { res, nextErr };
}

afterEach(() => {
  restoreMocks();
});

describe('Quiz Publication & Editing Controller Logic', () => {
  it('publishQuizAnswers rejects unauthorized faculty with ForbiddenError', async () => {
    prisma.quiz.findUnique = async () => ({
      id: 'quiz-1',
      title: 'Quiz 1',
      createdBy: 'faculty-owner',
      answersPublished: false,
    });

    const { nextErr } = await runHandler(quizController.publishQuizAnswers, {
      params: { quizId: 'quiz-1' },
      body: { publish: true },
      user: { userId: 'faculty-other', role: 'FACULTY' },
    });

    assert.ok(nextErr);
    assert.equal(nextErr.statusCode, 403);
  });

  it('publishQuizAnswers rejects unpublishing and repeated publication', async () => {
    prisma.quiz.findUnique = async () => ({
      id: 'quiz-1',
      title: 'Quiz 1',
      createdBy: 'faculty-1',
      answersPublished: false,
    });

    const unpublishRun = await runHandler(quizController.publishQuizAnswers, {
      params: { quizId: 'quiz-1' },
      body: { publish: false },
      user: { userId: 'faculty-1', role: 'FACULTY' },
    });
    assert.ok(unpublishRun.nextErr);
    assert.equal(unpublishRun.nextErr.statusCode, 400);

    prisma.quiz.findUnique = async () => ({
      id: 'quiz-1',
      title: 'Quiz 1',
      createdBy: 'faculty-1',
      answersPublished: true,
    });

    const repeatRun = await runHandler(quizController.publishQuizAnswers, {
      params: { quizId: 'quiz-1' },
      body: { publish: true },
      user: { userId: 'faculty-1', role: 'FACULTY' },
    });
    assert.ok(repeatRun.nextErr);
    assert.equal(repeatRun.nextErr.statusCode, 400);
  });

  it('publishQuizAnswers updates answersPublished to true for quiz creator', async () => {
    let updatePayload = null;
    prisma.quiz.findUnique = async () => ({
      id: 'quiz-1',
      title: 'DBMS Quiz',
      createdBy: 'faculty-1',
      answersPublished: false,
    });
    prisma.quiz.update = async ({ data }) => {
      updatePayload = data;
      return {
        id: 'quiz-1',
        title: 'DBMS Quiz',
        answersPublished: true,
      };
    };

    const { res, nextErr } = await runHandler(quizController.publishQuizAnswers, {
      params: { quizId: 'quiz-1' },
      body: {},
      user: { userId: 'faculty-1', role: 'FACULTY' },
    });

    assert.equal(nextErr, null);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(updatePayload, { answersPublished: true });
    assert.equal(res.body.data.answersPublished, true);
  });

  it('getSubmissions returns quiz metadata including answersPublished and scopes to owner', async () => {
    prisma.quiz.findUnique = async () => ({
      id: 'quiz-1',
      title: 'OS Quiz',
      subject: 'Operating Systems',
      totalMarks: 20,
      answersPublished: false,
      createdBy: 'faculty-owner',
    });

    const denied = await runHandler(quizController.getSubmissions, {
      params: { quizId: 'quiz-1' },
      user: { userId: 'faculty-other', role: 'FACULTY' },
    });
    assert.ok(denied.nextErr);
    assert.equal(denied.nextErr.statusCode, 403);

    prisma.quizAttempt.findMany = async () => [
      {
        id: 'attempt-1',
        status: 'COMPLETED',
        totalScore: 18,
        endTime: '2026-11-11T10:00:00.000Z',
        student: { id: 'stu-1', name: 'Asha', rollNumber: '24CS001' },
      },
    ];

    const allowed = await runHandler(quizController.getSubmissions, {
      params: { quizId: 'quiz-1' },
      user: { userId: 'faculty-owner', role: 'FACULTY' },
    });
    assert.equal(allowed.nextErr, null);
    assert.equal(allowed.res.statusCode, 200);
    assert.equal(allowed.res.body.quiz.answersPublished, false);
    assert.equal(allowed.res.body.data.length, 1);
    assert.equal(allowed.res.body.data[0].student.rollNumber, '24CS001');
  });

  it('updateQuiz updates metadata and questions when no attempts exist, and updates questions in-place when attempts exist', async () => {
    let attemptCountMock = 0;
    let deletedQuestionsFor = null;
    let createdQuestionsCount = 0;
    let updatedQuestionInPlace = false;

    prisma.quiz.findUnique = async () => ({
      id: 'quiz-1',
      createdBy: 'faculty-1',
      title: 'Old Title',
      subject: 'DBMS',
      answersPublished: false,
      questions: [
        {
          id: 'q-1',
          type: 'MCQ',
          text: 'Old?',
          options: ['Yes', 'No'],
          answerKey: 'No',
          marks: 1,
          negativeMarks: 0,
        },
      ],
      _count: { attempts: attemptCountMock },
    });
    prisma.quizAttempt.count = async () => attemptCountMock;
    prisma.user.findUnique = async () => ({ subject: 'DBMS' });
    prisma.$transaction = async (fn) => {
      const tx = {
        quizAttempt: {
          count: async () => attemptCountMock,
          findMany: async () => [],
        },
        quiz: {
          update: async ({ data }) => ({
            id: 'quiz-1',
            ...data,
          }),
        },
        quizDepartment: { deleteMany: async () => ({ count: 0 }), createMany: async () => ({ count: 0 }) },
        quizSection: { deleteMany: async () => ({ count: 0 }), createMany: async () => ({ count: 0 }) },
        quizStudent: { deleteMany: async () => ({ count: 0 }), createMany: async () => ({ count: 0 }) },
        questionUsage: { deleteMany: async () => ({ count: 0 }) },
        question: {
          deleteMany: async ({ where }) => {
            deletedQuestionsFor = where.quizId;
            return { count: 1 };
          },
          createMany: async ({ data }) => {
            createdQuestionsCount = data.length;
            return { count: data.length };
          },
          create: async () => {
            createdQuestionsCount += 1;
            return { id: `q-${createdQuestionsCount}` };
          },
          update: async ({ where, data }) => {
            updatedQuestionInPlace = true;
            return { id: where.id, ...data };
          },
          findMany: async () => [
            {
              id: 'q-1',
              type: 'MCQ',
              text: 'Changed?',
              options: ['Yes', 'No'],
              answerKey: 'Yes',
              marks: 1,
              negativeMarks: 0,
            },
          ],
        },
        quizEvaluationAudit: {
          create: async ({ data }) => data,
        },
      };
      return fn(tx);
    };

    const okUpdate = await runHandler(quizController.updateQuiz, {
      params: { quizId: 'quiz-1' },
      user: { userId: 'faculty-1', role: 'FACULTY' },
      body: {
        title: 'Updated Quiz Title',
        questions: [
          {
            type: 'FILL_BLANK',
            text: 'Primary key cannot be ____.',
            answerKey: ['NULL'],
            marks: 2,
          },
        ],
      },
    });

    assert.equal(okUpdate.nextErr, null);
    assert.equal(okUpdate.res.statusCode, 200);
    assert.equal(deletedQuestionsFor, 'quiz-1');
    assert.ok(createdQuestionsCount >= 1);

    attemptCountMock = 2;
    const inPlaceUpdate = await runHandler(quizController.updateQuiz, {
      params: { quizId: 'quiz-1' },
      user: { userId: 'faculty-1', role: 'FACULTY' },
      body: {
        title: 'Updated Quiz Title',
        questions: [
          {
            id: 'q-1',
            type: 'MCQ',
            text: 'Changed?',
            options: ['Yes', 'No'],
            answerKey: 'Yes',
            marks: 1,
          },
        ],
      },
    });

    assert.equal(inPlaceUpdate.nextErr, null);
    assert.equal(inPlaceUpdate.res.statusCode, 200);
    assert.equal(updatedQuestionInPlace, true);
  });
});

describe('Student Answer Publication Redaction & Visibility', () => {
  it('getEligibleQuizzes redacts scores/grades/feedback when answersPublished is false', async () => {
    prisma.user.findUnique = async () => ({
      id: 'stu-1',
      department: 'CSE',
      section: 'A',
      role: 'STUDENT',
    });
    prisma.quiz.findMany = async () => [
      {
        id: 'quiz-unpub',
        title: 'Unpublished Quiz',
        answersPublished: false,
        targetStudents: [],
        attempts: [
          {
            id: 'att-1',
            status: 'COMPLETED',
            score: 15,
            objectiveScore: 10,
            writtenScore: 5,
            totalScore: 15,
            finalGrade: 'A',
            facultyFeedback: 'Good work',
            performanceCategory: 'EXCELLENT',
            metrics: { accuracy: 75 },
          },
        ],
      },
      {
        id: 'quiz-pub',
        title: 'Published Quiz',
        answersPublished: true,
        targetStudents: [],
        attempts: [
          {
            id: 'att-2',
            status: 'COMPLETED',
            score: 19,
            objectiveScore: 19,
            writtenScore: 0,
            totalScore: 19,
            finalGrade: 'O',
            facultyFeedback: 'Great',
            performanceCategory: 'EXCELLENT',
            metrics: { accuracy: 95 },
          },
        ],
      },
    ];

    const { res, nextErr } = await runHandler(studentExamController.getEligibleQuizzes, {
      user: { userId: 'stu-1', role: 'STUDENT' },
    });

    assert.equal(nextErr, null);
    assert.equal(res.statusCode, 200);
    const unpub = res.body.data.find((q) => q.id === 'quiz-unpub');
    const pub = res.body.data.find((q) => q.id === 'quiz-pub');
    assert.equal(unpub.attempts[0].totalScore, undefined);
    assert.equal(unpub.attempts[0].score, undefined);
    assert.equal(unpub.attempts[0].finalGrade, undefined);
    assert.equal(unpub.attempts[0].facultyFeedback, undefined);
    assert.equal(pub.attempts[0].totalScore, 19);
    assert.equal(pub.attempts[0].finalGrade, 'O');
  });

  it('submitExam redacts score fields when answersPublished is false', async () => {
    prisma.quizAttempt.findUnique = async () => ({
      id: 'att-1',
      userId: 'stu-1',
      quizId: 'quiz-unpub',
      status: 'IN_PROGRESS',
      quiz: {
        id: 'quiz-unpub',
        answersPublished: false,
        questions: [
          {
            id: 'q-1',
            type: 'FILL_BLANK',
            marks: 2,
            negativeMarks: 0,
            answerKey: ['ACID'],
          },
        ],
        questionUsages: [],
      },
      responses: [
        {
          id: 'resp-1',
          questionId: 'q-1',
          status: 'ANSWERED',
          answerData: ['acid'],
        },
      ],
    });

    prisma.$transaction = async (fn) => {
      const tx = {
        quizResponse: {
          update: async () => ({}),
        },
        quizAttempt: {
          update: async () => ({
            id: 'att-1',
            quizId: 'quiz-unpub',
            status: 'COMPLETED',
            startTime: '2026-11-11T09:00:00.000Z',
            endTime: '2026-11-11T09:20:00.000Z',
            objectiveScore: 2,
            totalScore: 2,
            score: 2,
            finalGrade: 'O',
          }),
        },
      };
      return fn(tx);
    };

    const { res, nextErr } = await runHandler(studentExamController.submitExam, {
      params: { attemptId: 'att-1' },
      user: { userId: 'stu-1', role: 'STUDENT' },
      body: {},
    });

    assert.equal(nextErr, null);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.status, 'COMPLETED');
    assert.equal(res.body.data.totalScore, undefined);
    assert.equal(res.body.data.objectiveScore, undefined);
    assert.equal(res.body.data.finalGrade, undefined);
  });

  it('getQuizResult blocks unpublished quiz with 403 and exposes merged questions & marks once published', async () => {
    prisma.quiz.findUnique = async () => ({
      id: 'quiz-1',
      title: 'CN Quiz',
      answersPublished: false,
      questions: [],
      questionUsages: [],
    });

    const blocked = await runHandler(studentExamController.getQuizResult, {
      params: { quizId: 'quiz-1' },
      user: { userId: 'stu-1', role: 'STUDENT' },
    });
    assert.ok(blocked.nextErr);
    assert.equal(blocked.nextErr.statusCode, 403);

    prisma.quiz.findUnique = async () => ({
      id: 'quiz-1',
      title: 'CN Quiz',
      answersPublished: true,
      questions: [
        {
          id: 'q-match',
          type: 'MATCHING',
          text: 'Match protocol to port',
          marks: 4,
          answerKey: { HTTP: '80', HTTPS: '443' },
        },
      ],
      questionUsages: [],
    });
    prisma.quizAttempt.findFirst = async () => ({
      id: 'att-1',
      quizId: 'quiz-1',
      userId: 'stu-1',
      status: 'SUBMITTED',
      totalScore: 4,
      quiz: {
        id: 'quiz-1',
        title: 'CN Quiz',
        answersPublished: true,
        questions: [
          {
            id: 'q-match',
            type: 'MATCHING',
            text: 'Match protocol to port',
            marks: 4,
            negativeMarks: 0,
            answerKey: { HTTP: '80', HTTPS: '443' },
          },
        ],
        questionUsages: [],
      },
      responses: [
        {
          id: 'resp-1',
          questionId: 'q-match',
          answerData: { HTTP: '80', HTTPS: '443' },
          marksAwarded: null,
        },
      ],
    });

    const published = await runHandler(studentExamController.getQuizResult, {
      params: { quizId: 'quiz-1' },
      user: { userId: 'stu-1', role: 'STUDENT' },
    });
    assert.equal(published.nextErr, null);
    assert.equal(published.res.statusCode, 200);
    assert.equal(published.res.body.data.totalScore, 4);
    assert.equal(published.res.body.data.responses[0].marksAwarded, 4);
    assert.deepEqual(published.res.body.data.quiz.questions[0].answerKey, { HTTP: '80', HTTPS: '443' });
  });

  it('getDashboardData hides unpublished quiz scores from trajectory, deficits, and pastQuizzes', async () => {
    prisma.user.findUnique = async () => ({ id: 'stu-1', role: 'STUDENT' });
    prisma.quizAttempt.findMany = async () => [
      {
        id: 'att-unpub',
        status: 'SUBMITTED',
        totalScore: 12,
        objectiveScore: 12,
        writtenScore: 0,
        finalGrade: 'B',
        facultyFeedback: 'Private note',
        performanceCategory: 'AVERAGE',
        startTime: new Date('2026-11-11T09:00:00Z'),
        endTime: new Date('2026-11-11T10:00:00Z'),
        quiz: { id: 'q-unpub', title: 'Hidden Quiz', subject: 'DBMS', totalMarks: 20, answersPublished: false },
      },
      {
        id: 'att-pub',
        status: 'EVALUATED',
        totalScore: 18,
        objectiveScore: 18,
        writtenScore: 0,
        finalGrade: 'A',
        facultyFeedback: 'Well done',
        performanceCategory: 'EXCELLENT',
        startTime: new Date('2026-11-10T09:00:00Z'),
        endTime: new Date('2026-11-10T10:00:00Z'),
        quiz: { id: 'q-pub', title: 'Published Quiz', subject: 'OS', totalMarks: 20, answersPublished: true },
      },
    ];
    prisma.quizResponse.findMany = async ({ where }) => {
      assert.equal(where.attempt.quiz.answersPublished, true);
      return [];
    };
    if (prisma.assignmentSubmission) {
      prisma.assignmentSubmission.findMany = async () => [];
    }

    const res = createRes();
    await studentDashboardController.getDashboardData({ user: { userId: 'stu-1', role: 'STUDENT' } }, res);

    assert.equal(res.statusCode, 200);
    const data = res.body.data || res.body;
    assert.equal(data.performanceTrajectory.length, 1);
    assert.equal(data.performanceTrajectory[0].name, 'Published Quiz');
    const unpubPast = data.pastQuizzes.find((q) => q.quizId === 'q-unpub' || q.title === 'Hidden Quiz');
    const pubPast = data.pastQuizzes.find((q) => q.quizId === 'q-pub' || q.title === 'Published Quiz');
    assert.ok(unpubPast);
    assert.equal(unpubPast.answersPublished, false);
    assert.equal(unpubPast.status, 'Submitted Successfully');
    assert.equal(unpubPast.totalScore, null);
    assert.equal(unpubPast.grade, null);
    assert.equal(unpubPast.facultyFeedback, null);
    assert.ok(pubPast);
    assert.equal(pubPast.answersPublished, true);
    assert.equal(pubPast.totalScore, 18);
  });

  it('getSubmissions returns complete assigned class roster with NOT_SUBMITTED students, class labels, summary, and zero duplicates', async () => {
    let userFindManyWhere = null;

    prisma.quiz.findUnique = async () => ({
      id: 'quiz-multi',
      title: 'Multi-Class Quiz',
      subject: 'Operating Systems',
      totalMarks: 20,
      answersPublished: true,
      createdBy: 'faculty-owner',
      targetDepartments: [
        { departmentId: 'dept-cse', department: { id: 'dept-cse', name: 'CSE', batch: { id: 'b-2024', name: '2024-2028' } } },
      ],
      targetSections: [
        {
          sectionId: 'sec-a',
          section: { id: 'sec-a', name: 'Section A', departmentId: 'dept-cse', department: { id: 'dept-cse', name: 'CSE', batch: { id: 'b-2024', name: '2024-2028' } } },
        },
        {
          sectionId: 'sec-b',
          section: { id: 'sec-b', name: 'Section B', departmentId: 'dept-cse', department: { id: 'b-2024' ? 'dept-cse' : 'dept-cse', name: 'CSE', batch: { id: 'b-2024', name: '2024-2028' } } },
        },
      ],
      targetStudents: [],
    });

    prisma.quizAttempt.findMany = async () => [
      {
        id: 'attempt-1',
        userId: 'stu-a1',
        status: 'EVALUATED',
        objectiveScore: 0,
        writtenScore: 0,
        totalScore: 0,
        startTime: '2026-11-11T09:00:00.000Z',
        endTime: '2026-11-11T09:30:00.000Z',
        violationReason: null,
        responses: [],
        user: {
          id: 'stu-a1',
          name: 'Aarav',
          rollNumber: '24CS001',
          email: 'aarav@cira.edu',
          departmentId: 'dept-cse',
          sectionId: 'sec-a',
          department: { id: 'dept-cse', name: 'CSE', batch: { id: 'b-2024', name: '2024-2028' } },
          section: { id: 'sec-a', name: 'Section A' },
        },
      },
      {
        id: 'attempt-2',
        userId: 'stu-b1',
        status: 'SUBMITTED',
        objectiveScore: 10,
        writtenScore: 0,
        totalScore: 10,
        startTime: '2026-11-11T09:00:00.000Z',
        endTime: '2026-11-11T09:20:00.000Z',
        violationReason: 'Pressed key: Alt',
        responses: [],
        user: {
          id: 'stu-b1',
          name: 'Bhavya',
          rollNumber: '24CS101',
          email: 'bhavya@cira.edu',
          departmentId: 'dept-cse',
          sectionId: 'sec-b',
          department: { id: 'dept-cse', name: 'CSE', batch: { id: 'b-2024', name: '2024-2028' } },
          section: { id: 'sec-b', name: 'Section B' },
        },
      },
    ];

    prisma.user.findMany = async ({ where }) => {
      userFindManyWhere = where;
      return [
        {
          id: 'stu-a1',
          name: 'Aarav',
          rollNumber: '24CS001',
          email: 'aarav@cira.edu',
          departmentId: 'dept-cse',
          sectionId: 'sec-a',
          department: { id: 'dept-cse', name: 'CSE', batch: { id: 'b-2024', name: '2024-2028' } },
          section: { id: 'sec-a', name: 'Section A' },
        },
        {
          id: 'stu-a2',
          name: 'Ananya',
          rollNumber: '24CS002',
          email: 'ananya@cira.edu',
          departmentId: 'dept-cse',
          sectionId: 'sec-a',
          department: { id: 'dept-cse', name: 'CSE', batch: { id: 'b-2024', name: '2024-2028' } },
          section: { id: 'sec-a', name: 'Section A' },
        },
        {
          id: 'stu-b1',
          name: 'Bhavya',
          rollNumber: '24CS101',
          email: 'bhavya@cira.edu',
          departmentId: 'dept-cse',
          sectionId: 'sec-b',
          department: { id: 'dept-cse', name: 'CSE', batch: { id: 'b-2024', name: '2024-2028' } },
          section: { id: 'sec-b', name: 'Section B' },
        },
      ];
    };

    const { res, nextErr } = await runHandler(quizController.getSubmissions, {
      params: { quizId: 'quiz-multi' },
      user: { userId: 'faculty-owner', role: 'FACULTY' },
    });

    assert.equal(nextErr, null);
    assert.equal(res.statusCode, 200);
    // Scoped strictly to sec-a & sec-b without leaking whole dept-cse
    assert.deepEqual(userFindManyWhere.OR, [{ sectionId: { in: ['sec-a', 'sec-b'] } }]);

    assert.equal(res.body.assignedClasses.length, 2);
    assert.deepEqual(res.body.summary, {
      totalAssigned: 3,
      submitted: 2,
      notSubmitted: 1,
      violated: 1,
    });
    assert.equal(res.body.roster.length, 3);

    const aarav = res.body.roster.find((r) => r.userId === 'stu-a1');
    const ananya = res.body.roster.find((r) => r.userId === 'stu-a2');
    assert.equal(aarav.hasSubmitted, true);
    assert.equal(aarav.totalScore, 0);
    assert.equal(ananya.hasSubmitted, false);
    assert.equal(ananya.status, 'NOT_SUBMITTED');
    assert.equal(ananya.totalScore, null);
    assert.equal(ananya.classKey, 'section:sec-a');
  });

  it('normalizes Neon Object Storage presigned URLs to object keys on write and preserves legacy URLs', async () => {
    const presignedUrl =
      'https://uploads.files.neon.tech/cira-quiz-images/test-diagram-123.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=3600&X-Amz-Signature=deadbeef';
    assert.equal(
      objectStorage.extractObjectStorageKey(presignedUrl),
      'cira-quiz-images/test-diagram-123.png'
    );
    assert.equal(
      objectStorage.normalizeStoredImageValue(presignedUrl),
      'cira-quiz-images/test-diagram-123.png'
    );
    assert.equal(
      objectStorage.normalizeStoredImageValue('cira-quiz-images/already-a-key.jpg'),
      'cira-quiz-images/already-a-key.jpg'
    );
    assert.equal(
      objectStorage.normalizeStoredImageValue('https://res.cloudinary.com/demo/image/upload/sample.png'),
      'https://res.cloudinary.com/demo/image/upload/sample.png'
    );
    assert.equal(objectStorage.normalizeStoredImageValue(''), undefined);

    const validated = questionBankPolicy.validateQuestionBankPayload({
      category: 'TEST_QUIZ',
      type: 'MCQ',
      text: 'Identify the component',
      marks: 2,
      options: ['A', 'B'],
      answerKey: 'A',
      image: presignedUrl,
    });
    assert.equal(validated.image, 'cira-quiz-images/test-diagram-123.png');

    const validatedKey = questionBankPolicy.validateQuestionBankPayload({
      category: 'TEST_QUIZ',
      type: 'MCQ',
      text: 'Identify the component',
      marks: 2,
      options: ['A', 'B'],
      answerKey: 'A',
      image: 'cira-quiz-images/test-diagram-123.png',
    });
    assert.equal(validatedKey.image, 'cira-quiz-images/test-diagram-123.png');

    let savedImage = null;
    prisma.quiz.findUnique = async () => ({
      id: 'quiz-img-1',
      title: 'Image Quiz',
      createdBy: 'faculty-1',
    });
    prisma.quizAttempt.count = async () => 0;
    prisma.$transaction = async (items) => Promise.all(items);
    prisma.question.create = async ({ data }) => {
      savedImage = data.image;
      return { id: 'q-img-1', ...data };
    };

    const { res, nextErr } = await runHandler(quizController.addQuestions, {
      params: { quizId: 'quiz-img-1' },
      user: { userId: 'faculty-1', role: 'FACULTY' },
      body: {
        questions: [
          {
            type: 'MCQ',
            text: 'Look at the diagram',
            marks: 2,
            options: ['A', 'B'],
            answerKey: 'A',
            image: presignedUrl,
          },
        ],
      },
    });

    assert.equal(nextErr, null);
    assert.equal(res.statusCode, 201);
    assert.equal(savedImage, 'cira-quiz-images/test-diagram-123.png');
  });

  it('evaluateAttempt keeps auto and written marks separate, is idempotent, and rejects out-of-range marks', async () => {
    const mockResponses = [
      { id: 'r-mcq', marksAwarded: 5, question: { id: 'q1', type: 'MCQ', marks: 5 } },
      { id: 'r-tf', marksAwarded: 5, question: { id: 'q2', type: 'TRUE_FALSE', marks: 5 } },
      { id: 'r-written', marksAwarded: null, question: { id: 'q3', type: 'SHORT_WRITTEN', marks: 10 } },
    ];
    let attemptState = {
      id: 'attempt-eval-1',
      quizId: 'quiz-1',
      objectiveScore: 10,
      writtenScore: 0,
      totalScore: 10,
      quiz: { id: 'quiz-1', createdBy: 'faculty-1' },
      user: { id: 'stu-1', departmentId: 'dept-1', sectionId: 'sec-1' },
      responses: mockResponses,
    };

    prisma.quizAttempt.findUnique = async () => ({
      ...attemptState,
      responses: mockResponses.map((r) => ({ ...r, question: { ...r.question } })),
    });

    const updatedResponseIds = [];
    prisma.$transaction = async (fn) => {
      const tx = {
        quizResponse: {
          update: async ({ where, data }) => {
            updatedResponseIds.push(where.id);
            const target = mockResponses.find((r) => r.id === where.id);
            if (target) target.marksAwarded = data.marksAwarded;
            return target;
          },
        },
        quizAttempt: {
          update: async ({ data }) => {
            attemptState = { ...attemptState, ...data };
            return attemptState;
          },
        },
        quizEvaluationAudit: {
          create: async ({ data }) => data,
        },
      };
      return fn(tx);
    };

    // 1. Even if a client mistakenly sends objective responses (r-mcq, r-tf) along with r-written,
    // backend must ignore objective responses for writtenScore and never double-count them.
    const firstSave = await runHandler(quizController.evaluateAttempt, {
      params: { attemptId: 'attempt-eval-1' },
      user: { userId: 'faculty-1', role: 'FACULTY' },
      body: {
        evaluations: [
          { responseId: 'r-mcq', marks: 5 },
          { responseId: 'r-tf', marks: 5 },
          { responseId: 'r-written', marks: 6 },
        ],
        facultyFeedback: 'Good work',
      },
    });
    assert.equal(firstSave.nextErr, null);
    assert.equal(firstSave.res.statusCode, 200);
    assert.equal(firstSave.res.body.data.writtenScore, 6);
    assert.equal(firstSave.res.body.data.totalScore, 16);
    assert.deepEqual(updatedResponseIds, ['r-written']);

    // 2. Saving the exact same evaluation again must be idempotent (no doubling!)
    updatedResponseIds.length = 0;
    const secondSave = await runHandler(quizController.evaluateAttempt, {
      params: { attemptId: 'attempt-eval-1' },
      user: { userId: 'faculty-1', role: 'FACULTY' },
      body: {
        evaluations: [{ responseId: 'r-written', marks: 6 }],
        facultyFeedback: 'Good work',
      },
    });
    assert.equal(secondSave.nextErr, null);
    assert.equal(secondSave.res.body.data.writtenScore, 6);
    assert.equal(secondSave.res.body.data.totalScore, 16);

    // 3. Modifying written mark updates writtenScore & totalScore accurately
    const thirdSave = await runHandler(quizController.evaluateAttempt, {
      params: { attemptId: 'attempt-eval-1' },
      user: { userId: 'faculty-1', role: 'FACULTY' },
      body: {
        evaluations: [{ responseId: 'r-written', marks: 8 }],
      },
    });
    assert.equal(thirdSave.nextErr, null);
    assert.equal(thirdSave.res.body.data.writtenScore, 8);
    assert.equal(thirdSave.res.body.data.totalScore, 18);

    // 4. Rejects marks exceeding question max marks
    const invalidSave = await runHandler(quizController.evaluateAttempt, {
      params: { attemptId: 'attempt-eval-1' },
      user: { userId: 'faculty-1', role: 'FACULTY' },
      body: {
        evaluations: [{ responseId: 'r-written', marks: 15 }],
      },
    });
    assert.ok(invalidSave.nextErr);
    assert.equal(invalidSave.nextErr.statusCode, 400);
  });

  it('Scenario A: evaluateStudentForQuiz saves manual marks for an assigned unsubmitted student while keeping NOT_SUBMITTED status', async () => {
    const audits = [];
    let createdAttempt = null;
    const savedResponses = new Map();

    prisma.quiz.findUnique = async () => ({
      id: 'quiz-unsub-1',
      title: 'OS Quiz',
      createdBy: 'faculty-1',
      questions: [
        { id: 'q1', type: 'MCQ', marks: 5 },
        { id: 'q2', type: 'SHORT_WRITTEN', marks: 10 },
      ],
      targetDepartments: [{ departmentId: 'dept-1' }],
      targetSections: [],
      targetStudents: [],
    });

    prisma.user.findUnique = async ({ where }) =>
      where.id === 'stu-unsub'
        ? { id: 'stu-unsub', role: 'STUDENT', departmentId: 'dept-1', sectionId: 'sec-1' }
        : where.id === 'stu-other'
        ? { id: 'stu-other', role: 'STUDENT', departmentId: 'dept-99', sectionId: 'sec-99' }
        : null;

    // Unauthorized/unassigned student rejected with 403
    const unassigned = await runHandler(quizController.evaluateStudentForQuiz, {
      params: { quizId: 'quiz-unsub-1', studentId: 'stu-other' },
      user: { userId: 'faculty-1', role: 'FACULTY' },
      body: { evaluations: [{ questionId: 'q2', marks: 5 }] },
    });
    assert.ok(unassigned.nextErr);
    assert.equal(unassigned.nextErr.statusCode, 403);

    // Marks exceeding max rejected with 400
    const overMax = await runHandler(quizController.evaluateStudentForQuiz, {
      params: { quizId: 'quiz-unsub-1', studentId: 'stu-unsub' },
      user: { userId: 'faculty-1', role: 'FACULTY' },
      body: { evaluations: [{ questionId: 'q2', marks: 12 }] },
    });
    assert.ok(overMax.nextErr);
    assert.equal(overMax.nextErr.statusCode, 400);

    prisma.$transaction = async (fn) => {
      const tx = {
        quizAttempt: {
          findFirst: async () => createdAttempt,
          create: async ({ data }) => {
            createdAttempt = { id: 'att-manual-1', ...data, responses: [] };
            return createdAttempt;
          },
          update: async ({ data }) => {
            createdAttempt = { ...createdAttempt, ...data };
            return createdAttempt;
          },
        },
        quizResponse: {
          upsert: async ({ where, create, update }) => {
            const key = where.attemptId_questionId.questionId;
            const existing = savedResponses.get(key);
            const next = existing ? { ...existing, ...update } : { id: `resp-${key}`, ...create };
            savedResponses.set(key, next);
            return next;
          },
          findMany: async () => Array.from(savedResponses.values()),
        },
        quizEvaluationAudit: {
          create: async ({ data }) => {
            audits.push(data);
            return data;
          },
        },
      };
      return fn(tx);
    };

    const saved = await runHandler(quizController.evaluateStudentForQuiz, {
      params: { quizId: 'quiz-unsub-1', studentId: 'stu-unsub' },
      user: { userId: 'faculty-1', role: 'FACULTY' },
      body: {
        evaluations: [
          { questionId: 'q1', marks: 0 },
          { questionId: 'q2', marks: 7 },
        ],
        facultyFeedback: 'Oral viva evaluation',
      },
    });

    assert.equal(saved.nextErr, null);
    assert.equal(saved.res.statusCode, 200);
    assert.equal(saved.res.body.data.isManualWithoutSubmission, true);
    assert.equal(saved.res.body.data.endTime, null);
    assert.equal(saved.res.body.data.objectiveScore, 0);
    assert.equal(saved.res.body.data.writtenScore, 7);
    assert.equal(saved.res.body.data.totalScore, 7);
    assert.equal(audits.length, 1);
    assert.equal(audits[0].action, 'MANUAL_EVAL_CREATE');
  });

  it('Scenarios C, D, E: updateQuiz regrades objective questions on published answer-key change, preserves written marks, notifies affected students once, and is idempotent', async () => {
    const audits = [];
    const notifications = [];
    const updatedQuestions = [];
    const updatedAttempts = [];

    let questionState = [
      { id: 'q-mcq', type: 'MCQ', text: 'Q1', marks: 5, negativeMarks: 0, options: ['A', 'B', 'C'], answerKey: 'B' },
      { id: 'q-written', type: 'SHORT_WRITTEN', text: 'Q2', marks: 10, negativeMarks: 0, options: null, answerKey: 'Explain' },
    ];
    let attemptState = {
      id: 'att-1',
      quizId: 'quiz-pub-1',
      userId: 'stu-1',
      status: 'EVALUATED',
      isManualWithoutSubmission: false,
      objectiveScore: 0,
      writtenScore: 8,
      totalScore: 8,
      needsReview: false,
      resultUpdatedAt: null,
      responses: [
        { id: 'r1', questionId: 'q-mcq', status: 'ANSWERED', answerData: 'C', marksAwarded: 0, question: questionState[0] },
        { id: 'r2', questionId: 'q-written', status: 'ANSWERED', answerData: 'My answer', marksAwarded: 8, question: questionState[1] },
      ],
    };

    prisma.quiz.findUnique = async () => ({
      id: 'quiz-pub-1',
      title: 'Published Quiz',
      subject: 'DBMS',
      createdBy: 'faculty-1',
      answersPublished: true,
      questions: questionState.map((q) => ({ ...q })),
    });
    prisma.user.findUnique = async () => ({ subject: 'DBMS' });

    prisma.$transaction = async (fn) => {
      const tx = {
        quizAttempt: {
          count: async () => 1,
          findMany: async () => [
            {
              ...attemptState,
              responses: attemptState.responses.map((r) => ({ ...r, question: { ...r.question } })),
            },
          ],
          update: async ({ data }) => {
            attemptState = { ...attemptState, ...data };
            updatedAttempts.push(data);
            return attemptState;
          },
        },
        quiz: { update: async ({ data }) => ({ id: 'quiz-pub-1', ...data }) },
        quizDepartment: { deleteMany: async () => {}, createMany: async () => {} },
        quizSection: { deleteMany: async () => {}, createMany: async () => {} },
        quizStudent: { deleteMany: async () => {}, createMany: async () => {} },
        question: {
          update: async ({ where, data }) => {
            questionState = questionState.map((q) => (q.id === where.id ? { ...q, ...data } : q));
            updatedQuestions.push({ id: where.id, ...data });
            return questionState.find((q) => q.id === where.id);
          },
          findMany: async () => questionState,
        },
        quizResponse: {
          update: async ({ where, data }) => {
            attemptState.responses = attemptState.responses.map((r) =>
              r.id === where.id ? { ...r, ...data } : r
            );
          },
        },
        quizEvaluationAudit: {
          create: async ({ data }) => {
            audits.push(data);
            return data;
          },
        },
        studentNotification: {
          create: async ({ data }) => {
            notifications.push(data);
            return data;
          },
        },
      };
      return fn(tx);
    };

    // Change MCQ answerKey from B -> C (student had answered C, so auto score 0 -> 5, written stays 8, total 8 -> 13)
    const firstEdit = await runHandler(quizController.updateQuiz, {
      params: { quizId: 'quiz-pub-1' },
      user: { userId: 'faculty-1', role: 'FACULTY' },
      body: {
        title: 'Published Quiz',
        totalMarks: 15,
        passingMarks: 5,
        questions: [
          { id: 'q-mcq', type: 'MCQ', text: 'Q1', marks: 5, options: ['A', 'B', 'C'], answerKey: 'C' },
          { id: 'q-written', type: 'SHORT_WRITTEN', text: 'Q2', marks: 10, answerKey: 'Explain' },
        ],
      },
    });

    assert.equal(firstEdit.nextErr, null);
    assert.equal(firstEdit.res.statusCode, 200);
    assert.equal(firstEdit.res.body.regradedCount, 1);
    assert.equal(attemptState.objectiveScore, 5);
    assert.equal(attemptState.writtenScore, 8);
    assert.equal(attemptState.totalScore, 13);
    assert.equal(notifications.length, 1);
    assert.equal(audits.some((a) => a.action === 'ANSWER_KEY_UPDATE'), true);
    assert.equal(audits.some((a) => a.action === 'AUTO_REGRADE'), true);

    // Scenario E: Repeated save with no changes produces 0 regrades and 0 duplicate notifications
    audits.length = 0;
    notifications.length = 0;
    const secondEdit = await runHandler(quizController.updateQuiz, {
      params: { quizId: 'quiz-pub-1' },
      user: { userId: 'faculty-1', role: 'FACULTY' },
      body: {
        title: 'Published Quiz',
        totalMarks: 15,
        passingMarks: 5,
        questions: [
          { id: 'q-mcq', type: 'MCQ', text: 'Q1', marks: 5, options: ['A', 'B', 'C'], answerKey: 'C' },
          { id: 'q-written', type: 'SHORT_WRITTEN', text: 'Q2', marks: 10, answerKey: 'Explain' },
        ],
      },
    });

    assert.equal(secondEdit.nextErr, null);
    assert.equal(secondEdit.res.body.regradedCount, 0);
    assert.equal(attemptState.totalScore, 13);
    assert.equal(audits.length, 0);
    assert.equal(notifications.length, 0);
  });
});
