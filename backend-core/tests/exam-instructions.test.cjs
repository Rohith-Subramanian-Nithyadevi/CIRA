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

describe('student exam read-only instructions endpoint', () => {
  it('returns quiz metadata cleanly without creating a QuizAttempt or leaking questions', async () => {
    const origQuizFindUnique = prisma.quiz.findUnique;
    const origUserFindUnique = prisma.user.findUnique;
    const origAttemptFindFirst = prisma.quizAttempt.findFirst;
    const origAttemptCreate = prisma.quizAttempt.create;
    let createdAttempt = false;

    prisma.quiz.findUnique = async () => ({
      id: 'quiz-1',
      title: 'Operating Systems Unit 1',
      subject: 'Operating Systems',
      description: 'Processes and Scheduling',
      totalMarks: 25,
      passingMarks: 10,
      durationMinutes: 45,
      startDate: new Date(Date.now() - 60_000),
      endDate: new Date(Date.now() + 3_600_000),
      paperStatus: 'PUBLISHED',
      targetDepartments: [{ departmentId: 'dept-1' }],
      targetSections: [],
      targetStudents: [],
      questions: [{ id: 'q1' }, { id: 'q2' }],
      questionUsages: [{ questionId: 'q2' }, { questionId: 'q3' }],
    });
    prisma.user.findUnique = async () => ({ departmentId: 'dept-1', sectionId: 'sec-1' });
    prisma.quizAttempt.findFirst = async () => null;
    prisma.quizAttempt.create = async () => {
      createdAttempt = true;
      return {};
    };

    try {
      const res = createMockRes();
      let nextErr;
      await studentExamController.getQuizInstructions(
        { user: { userId: 'student-1', role: 'STUDENT' }, params: { quizId: 'quiz-1' } },
        res,
        (err) => {
          nextErr = err;
        }
      );
      assert.equal(nextErr, undefined);
      assert.equal(createdAttempt, false);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.status, 'success');
      assert.equal(res.body.data.quiz.title, 'Operating Systems Unit 1');
      assert.equal(res.body.data.quiz.questionCount, 3);
      assert.equal(res.body.data.quiz.questions, undefined);
    } finally {
      prisma.quiz.findUnique = origQuizFindUnique;
      prisma.user.findUnique = origUserFindUnique;
      prisma.quizAttempt.findFirst = origAttemptFindFirst;
      prisma.quizAttempt.create = origAttemptCreate;
    }
  });

  it('blocks ineligible, expired, and already-submitted students', async () => {
    const origQuizFindUnique = prisma.quiz.findUnique;
    const origUserFindUnique = prisma.user.findUnique;
    const origAttemptFindFirst = prisma.quizAttempt.findFirst;

    try {
      // Out of scope department
      prisma.quiz.findUnique = async () => ({
        id: 'quiz-1',
        paperStatus: 'PUBLISHED',
        targetDepartments: [{ departmentId: 'dept-other' }],
        targetSections: [],
        targetStudents: [],
        questions: [],
        questionUsages: [],
      });
      prisma.user.findUnique = async () => ({ departmentId: 'dept-1', sectionId: 'sec-1' });
      let err1;
      await studentExamController.getQuizInstructions(
        { user: { userId: 'student-1', role: 'STUDENT' }, params: { quizId: 'quiz-1' } },
        createMockRes(),
        (err) => { err1 = err; }
      );
      assert.equal(err1.statusCode, 403);

      // Already submitted
      prisma.quiz.findUnique = async () => ({
        id: 'quiz-1',
        paperStatus: 'PUBLISHED',
        targetDepartments: [{ departmentId: 'dept-1' }],
        targetSections: [],
        targetStudents: [],
        questions: [],
        questionUsages: [],
      });
      prisma.quizAttempt.findFirst = async () => ({ id: 'att-1', status: 'SUBMITTED', startTime: new Date() });
      let err2;
      await studentExamController.getQuizInstructions(
        { user: { userId: 'student-1', role: 'STUDENT' }, params: { quizId: 'quiz-1' } },
        createMockRes(),
        (err) => { err2 = err; }
      );
      assert.equal(err2.statusCode, 400);
      assert.equal(err2.errorCode, 'ALREADY_SUBMITTED');

      // Expired
      prisma.quizAttempt.findFirst = async () => null;
      prisma.quiz.findUnique = async () => ({
        id: 'quiz-1',
        paperStatus: 'PUBLISHED',
        endDate: new Date(Date.now() - 60_000),
        targetDepartments: [{ departmentId: 'dept-1' }],
        targetSections: [],
        targetStudents: [],
        questions: [],
        questionUsages: [],
      });
      let err3;
      await studentExamController.getQuizInstructions(
        { user: { userId: 'student-1', role: 'STUDENT' }, params: { quizId: 'quiz-1' } },
        createMockRes(),
        (err) => { err3 = err; }
      );
      assert.equal(err3.statusCode, 400);
      assert.equal(err3.errorCode, 'EXPIRED');
    } finally {
      prisma.quiz.findUnique = origQuizFindUnique;
      prisma.user.findUnique = origUserFindUnique;
      prisma.quizAttempt.findFirst = origAttemptFindFirst;
    }
  });
});

