const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const { prisma } = require('../dist/config/prisma');
const quizController = require('../dist/controllers/quiz.controller');
const studentExamController = require('../dist/controllers/student-exam.controller');
const studentDashboardController = require('../dist/controllers/student-dashboard.controller');

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

  it('updateQuiz updates metadata and questions when no attempts exist, and blocks question edits when attempts exist', async () => {
    let attemptCountMock = 0;
    let deletedQuestionsFor = null;
    let createdQuestionsCount = 0;

    prisma.quiz.findUnique = async () => ({
      id: 'quiz-1',
      createdBy: 'faculty-1',
      title: 'Old Title',
      subject: 'DBMS',
      _count: { attempts: attemptCountMock },
    });
    prisma.quizAttempt.count = async () => attemptCountMock;
    prisma.user.findUnique = async () => ({ subject: 'DBMS' });
    prisma.$transaction = async (fn) => {
      const tx = {
        quizAttempt: {
          count: async () => attemptCountMock,
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
    const blockedUpdate = await runHandler(quizController.updateQuiz, {
      params: { quizId: 'quiz-1' },
      user: { userId: 'faculty-1', role: 'FACULTY' },
      body: {
        title: 'Updated Quiz Title',
        questions: [
          {
            type: 'MCQ',
            text: 'Changed?',
            options: ['Yes', 'No'],
            answerKey: 'Yes',
            marks: 1,
          },
        ],
      },
    });

    assert.ok(blockedUpdate.nextErr);
    assert.equal(blockedUpdate.nextErr.statusCode, 400);
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
});
