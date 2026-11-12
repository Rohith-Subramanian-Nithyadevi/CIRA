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
  it('persists violations, deduplicates simultaneous events, and auto-submits at maxViolations', async () => {
    const origAttemptFindUnique = prisma.quizAttempt.findUnique;
    const origViolationFindFirst = prisma.quizViolation.findFirst;
    const origTransaction = prisma.$transaction;

    let attemptState = {
      id: 'att-1',
      quizId: 'quiz-1',
      userId: 'stu-1',
      status: 'IN_PROGRESS',
      violationCount: 0,
      violationReason: null,
      responses: [
        { id: 'r-1', questionId: 'q-1', status: 'ANSWERED', answerData: 'A' },
      ],
      quiz: {
        id: 'quiz-1',
        autoSubmit: true,
        maxViolations: 3,
        questions: [
          { id: 'q-1', type: 'MCQ', marks: 5, negativeMarks: 0, answerKey: 'A' },
        ],
        questionUsages: [],
      },
    };
    const recordedViolations = [];

    prisma.quizAttempt.findUnique = async () => ({ ...attemptState });
    prisma.quizViolation.findFirst = async ({ where }) => {
      const since = where.createdAt.gte;
      return recordedViolations.find((v) => v.createdAt >= since) || null;
    };
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
          update: async ({ data }) => {
            attemptState = { ...attemptState, ...data };
            return attemptState;
          },
        },
      };
      return fn(tx);
    };

    try {
      // 1. First violation: TAB_SWITCH
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
      assert.equal(res1.body.data.violationCount, 1);
      assert.equal(res1.body.data.autoSubmitted, false);
      assert.equal(res1.body.data.deduplicated, false);

      // 2. Simultaneous WINDOW_BLUR within 1500ms -> deduplicated
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
      assert.equal(res2.statusCode, 200);
      assert.equal(res2.body.data.violationCount, 1);
      assert.equal(res2.body.data.deduplicated, true);

      // Clear dedupe window by backdating recorded violation
      recordedViolations[0].createdAt = new Date(Date.now() - 5000);

      // 3. Second violation: FULLSCREEN_EXIT
      const res3 = createMockRes();
      await studentExamController.recordViolation(
        {
          user: { userId: 'stu-1', role: 'STUDENT' },
          params: { attemptId: 'att-1' },
          body: { type: 'FULLSCREEN_EXIT', reason: 'Exited fullscreen' },
        },
        res3,
        (err) => { throw err; }
      );
      assert.equal(res3.body.data.violationCount, 2);
      assert.equal(res3.body.data.autoSubmitted, false);

      recordedViolations[1].createdAt = new Date(Date.now() - 5000);

      // 4. Third violation -> reaches maxViolations (3) and auto-submits with objective grading
      const res4 = createMockRes();
      await studentExamController.recordViolation(
        {
          user: { userId: 'stu-1', role: 'STUDENT' },
          params: { attemptId: 'att-1' },
          body: { type: 'TAB_SWITCH', reason: 'Switched tab again' },
        },
        res4,
        (err) => { throw err; }
      );
      assert.equal(res4.body.data.violationCount, 3);
      assert.equal(res4.body.data.autoSubmitted, true);
      assert.equal(attemptState.status, 'SUBMITTED');
      assert.equal(attemptState.objectiveScore, 5);
      assert.equal(attemptState.totalScore, 5);
      assert.match(attemptState.violationReason, /3\/3 violations/);
    } finally {
      prisma.quizAttempt.findUnique = origAttemptFindUnique;
      prisma.quizViolation.findFirst = origViolationFindFirst;
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

