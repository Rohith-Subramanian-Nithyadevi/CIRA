const { before, describe, it } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'unit-test-jwt-secret';

let studentExamController;
let prisma;

before(() => {
  studentExamController = require('../dist/controllers/student-exam.controller');
  prisma = require('../dist/config/prisma').prisma;
});

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    set(k, v) {
      this.headers[k] = v;
      return this;
    },
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

describe('Student Exam Violation Monitoring & Session Persistence', () => {
  it('persists VIOLATED lock atomically, blocks instructions/start/save/submit while locked, and allows fresh attempt after faculty allowRestart without deleting history', async () => {
    const origAttemptFindUnique = prisma.quizAttempt.findUnique;
    const origAttemptFindFirst = prisma.quizAttempt.findFirst;
    const origAttemptUpdate = prisma.quizAttempt.update;
    const origQuizFindUnique = prisma.quiz.findUnique;
    const origUserFindUnique = prisma.user.findUnique;
    const origTransaction = prisma.$transaction;

    let attemptState = {
      id: 'att-1',
      quizId: 'quiz-1',
      userId: 'stu-1',
      status: 'IN_PROGRESS',
      startTime: new Date(Date.now() - 30_000),
      violationCount: 0,
      violationReason: null,
      restartAuthorized: false,
      restartAuthorizedAt: null,
      restartAuthorizedBy: null,
      responses: [
        { id: 'r-1', questionId: 'q-1', status: 'ANSWERED', answerData: 'A' },
      ],
      quiz: {
        id: 'quiz-1',
        createdBy: 'faculty-1',
        durationMinutes: 45,
        autoSubmit: true,
        maxViolations: 1,
        paperStatus: 'PUBLISHED',
        targetDepartments: [{ departmentId: 'dept-1' }],
        targetSections: [],
        targetStudents: [],
        questions: [
          { id: 'q-1', type: 'MCQ', marks: 5, negativeMarks: 0, answerKey: 'A' },
        ],
        questionUsages: [],
      },
    };
    const recordedViolations = [];
    const createdAttempts = [];

    prisma.quizAttempt.findUnique = async () => ({ ...attemptState });
    prisma.quizAttempt.findFirst = async () => ({ ...attemptState });
    prisma.quizAttempt.update = async ({ data }) => {
      attemptState = { ...attemptState, ...data };
      return attemptState;
    };
    prisma.quiz.findUnique = async () => attemptState.quiz;
    prisma.user.findUnique = async () => ({ departmentId: 'dept-1', sectionId: 'sec-1' });
    prisma.$transaction = async (fn) => {
      const tx = {
        quizViolation: {
          create: async ({ data }) => {
            const row = { id: `v-${recordedViolations.length + 1}`, ...data, createdAt: new Date() };
            recordedViolations.push(row);
            return row;
          },
        },
        quizResponse: {
          update: async () => ({}),
        },
        quizAttempt: {
          updateMany: async ({ where, data }) => {
            if (where.status && attemptState.status !== where.status) return { count: 0 };
            if (where.restartAuthorized !== undefined && attemptState.restartAuthorized !== where.restartAuthorized) {
              return { count: 0 };
            }
            attemptState = { ...attemptState, ...data };
            return { count: 1 };
          },
          create: async ({ data }) => {
            const fresh = { id: 'att-fresh-2', ...data, responses: [] };
            createdAttempts.push(fresh);
            return fresh;
          },
        },
      };
      return fn(tx);
    };

    try {
      // 1. Violation immediately locks attempt as VIOLATED
      const res1 = createMockRes();
      await studentExamController.recordViolation(
        {
          user: { userId: 'stu-1', role: 'STUDENT' },
          params: { attemptId: 'att-1' },
          body: { type: 'TAB_SWITCH', reason: 'Switched tab' },
        },
        res1,
        (err) => { throw err; }
      );
      assert.equal(res1.statusCode, 200);
      assert.equal(res1.body.data.status, 'VIOLATED');
      assert.equal(res1.body.data.locked, true);
      assert.equal(res1.body.data.autoSubmitted, true);
      assert.equal(attemptState.status, 'VIOLATED');
      assert.equal(attemptState.objectiveScore, 5);
      assert.equal(recordedViolations.length, 1);

      // 2. Simultaneous second violation does not create duplicate record
      const res2 = createMockRes();
      await studentExamController.recordViolation(
        {
          user: { userId: 'stu-1', role: 'STUDENT' },
          params: { attemptId: 'att-1' },
          body: { type: 'WINDOW_BLUR', reason: 'Lost focus' },
        },
        res2,
        (err) => { throw err; }
      );
      assert.equal(res2.body.data.deduplicated, true);
      assert.equal(recordedViolations.length, 1);

      // 3. Student is blocked on instructions, startExam, saveResponse, and submitExam
      for (const [handler, req] of [
        [studentExamController.getQuizInstructions, { user: { userId: 'stu-1', role: 'STUDENT' }, params: { quizId: 'quiz-1' } }],
        [studentExamController.startExam, { user: { userId: 'stu-1', role: 'STUDENT' }, params: { quizId: 'quiz-1' } }],
        [studentExamController.saveResponse, { user: { userId: 'stu-1', role: 'STUDENT' }, params: { attemptId: 'att-1' }, body: { questionId: 'q-1', answerData: 'B' } }],
        [studentExamController.submitExam, { user: { userId: 'stu-1', role: 'STUDENT' }, params: { attemptId: 'att-1' }, body: {} }],
      ]) {
        let err;
        await handler(req, createMockRes(), (e) => { err = e; });
        assert.equal(err.statusCode, 403);
        assert.equal(err.errorCode, 'ATTEMPT_LOCKED');
      }

      // 4. Faculty authorizes restart -> preserves old VIOLATED attempt & violation history
      const restartRes = createMockRes();
      await studentExamController.allowRestart(
        { user: { userId: 'faculty-1', role: 'FACULTY' }, params: { attemptId: 'att-1' } },
        restartRes,
        (err) => { throw err; }
      );
      assert.equal(restartRes.statusCode, 200);
      assert.equal(attemptState.restartAuthorized, true);
      assert.equal(attemptState.status, 'VIOLATED');
      assert.equal(recordedViolations.length, 1);

      // 5. Student starts fresh attempt after authorization
      const startRes = createMockRes();
      await studentExamController.startExam(
        { user: { userId: 'stu-1', role: 'STUDENT' }, params: { quizId: 'quiz-1' } },
        startRes,
        (err) => { throw err; }
      );
      assert.equal(startRes.statusCode, 200);
      assert.equal(startRes.body.data.attempt.id, 'att-fresh-2');
      assert.equal(startRes.body.data.attempt.status, 'IN_PROGRESS');
      assert.equal(startRes.body.data.attempt.violationCount, 0);
      assert.equal(attemptState.restartAuthorized, false);
    } finally {
      prisma.quizAttempt.findUnique = origAttemptFindUnique;
      prisma.quizAttempt.findFirst = origAttemptFindFirst;
      prisma.quizAttempt.update = origAttemptUpdate;
      prisma.quiz.findUnique = origQuizFindUnique;
      prisma.user.findUnique = origUserFindUnique;
      prisma.$transaction = origTransaction;
    }
  });

  it('resumes IN_PROGRESS attempt on refresh after >60s within duration without clearing violationCount', async () => {
    const origAttemptFindFirst = prisma.quizAttempt.findFirst;
    const origQuizFindUnique = prisma.quiz.findUnique;
    const origUserFindUnique = prisma.user.findUnique;

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    prisma.quizAttempt.findFirst = async () => ({
      id: 'att-resume-1',
      quizId: 'quiz-1',
      userId: 'stu-1',
      status: 'IN_PROGRESS',
      startTime: tenMinutesAgo,
      violationCount: 2,
      responses: [{ id: 'r-1', questionId: 'q-1', answerData: 'B', status: 'ANSWERED' }],
    });
    prisma.quiz.findUnique = async () => ({
      id: 'quiz-1',
      title: 'Resumable Quiz',
      durationMinutes: 45,
      maxViolations: 3,
      paperStatus: 'PUBLISHED',
      targetDepartments: [{ departmentId: 'dept-1' }],
      targetSections: [],
      targetStudents: [],
      questions: [],
      questionUsages: [],
    });
    prisma.user.findUnique = async () => ({ departmentId: 'dept-1', sectionId: 'sec-1' });

    try {
      const res = createMockRes();
      let nextErr;
      await studentExamController.startExam(
        { user: { userId: 'stu-1', role: 'STUDENT' }, params: { quizId: 'quiz-1' } },
        res,
        (err) => { nextErr = err; }
      );
      assert.equal(nextErr, undefined);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.data.attempt.id, 'att-resume-1');
      assert.equal(res.body.data.attempt.violationCount, 2);
      assert.equal(res.body.data.attempt.responses.length, 1);
    } finally {
      prisma.quizAttempt.findFirst = origAttemptFindFirst;
      prisma.quiz.findUnique = origQuizFindUnique;
      prisma.user.findUnique = origUserFindUnique;
    }
  });
});

