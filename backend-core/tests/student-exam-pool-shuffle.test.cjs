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
    set() {
      return this;
    },
  };
}

describe('Question Pool Subset Sampling & Per-Student Random Shuffling', () => {
  const poolQuestions = Array.from({ length: 10 }, (_, i) => ({
    id: `q-${i + 1}`,
    type: 'MCQ',
    text: `Question ${i + 1} text`,
    marks: 2,
    negativeMarks: 0,
    options: ['A', 'B', 'C', 'D'],
    quizId: 'pool-quiz-1',
    image: null,
  }));

  it('selects a randomized subset from the pool without repeated questions per student', async () => {
    const origQuizFindUnique = prisma.quiz.findUnique;
    const origUserFindUnique = prisma.user.findUnique;
    const origAttemptFindFirst = prisma.quizAttempt.findFirst;
    const origAttemptCreate = prisma.quizAttempt.create;
    const origAttemptUpdate = prisma.quizAttempt.update;

    let savedMetricsStudentA = null;

    prisma.user.findUnique = async () => ({ departmentId: 'dept-1', sectionId: 'sec-1' });

    // Mock quiz with 10 questions, but questionPoolCount = 4
    prisma.quiz.findUnique = async () => ({
      id: 'pool-quiz-1',
      title: 'Pool Quiz',
      subject: 'Algorithms',
      paperStatus: 'PUBLISHED',
      totalMarks: 20,
      durationMinutes: 60,
      performanceBands: { questionPoolCount: 4 },
      targetDepartments: [{ departmentId: 'dept-1' }],
      targetSections: [],
      targetStudents: [],
      questions: poolQuestions.map((q) => ({ ...q })),
      questionUsages: [],
    });

    // Student A start
    prisma.quizAttempt.findFirst = async () => null;
    prisma.quizAttempt.create = async ({ data }) => ({
      id: 'attempt-student-A',
      quizId: data.quizId,
      userId: data.userId,
      status: 'IN_PROGRESS',
      startTime: new Date(),
      metrics: null,
      responses: [],
    });
    prisma.quizAttempt.update = async ({ data }) => {
      savedMetricsStudentA = data.metrics;
      return { id: 'attempt-student-A', metrics: data.metrics };
    };

    try {
      const resA = createMockRes();
      await studentExamController.startExam(
        { user: { userId: 'student-A', role: 'STUDENT' }, params: { quizId: 'pool-quiz-1' } },
        resA,
        (err) => { if (err) throw err; }
      );

      assert.equal(resA.statusCode, 200);
      const questionsA = resA.body.data.quiz.questions;
      // Exactly 4 questions selected from the pool
      assert.equal(questionsA.length, 4);
      // Zero duplicate questions
      const idsA = new Set(questionsA.map((q) => q.id));
      assert.equal(idsA.size, 4);
      // All 4 questions are members of the 10 pool questions
      for (const q of questionsA) {
        assert.ok(poolQuestions.some((pq) => pq.id === q.id));
      }
      // Quiz totalMarks adjusted to match subset (4 questions * 2 marks = 8 marks)
      assert.equal(resA.body.data.quiz.totalMarks, 8);
      // Metrics saved in attempt
      assert.ok(savedMetricsStudentA);
      assert.equal(savedMetricsStudentA.questionOrder.length, 4);
      assert.equal(savedMetricsStudentA.isPoolSubset, true);

      // Student A resumes on refresh: must preserve the exact same 4 questions in exact same order
      prisma.quizAttempt.findFirst = async () => ({
        id: 'attempt-student-A',
        quizId: 'pool-quiz-1',
        userId: 'student-A',
        status: 'IN_PROGRESS',
        startTime: new Date(),
        metrics: savedMetricsStudentA,
        responses: [],
      });

      const resResume = createMockRes();
      await studentExamController.startExam(
        { user: { userId: 'student-A', role: 'STUDENT' }, params: { quizId: 'pool-quiz-1' } },
        resResume,
        (err) => { if (err) throw err; }
      );
      assert.equal(resResume.statusCode, 200);
      const resumedQuestions = resResume.body.data.quiz.questions;
      assert.deepEqual(
        resumedQuestions.map((q) => q.id),
        questionsA.map((q) => q.id)
      );

      // Student B starts: receives their own randomized subset and shuffle
      let savedMetricsStudentB = null;
      prisma.quizAttempt.findFirst = async () => null;
      prisma.quizAttempt.create = async ({ data }) => ({
        id: 'attempt-student-B',
        quizId: data.quizId,
        userId: data.userId,
        status: 'IN_PROGRESS',
        startTime: new Date(),
        metrics: null,
        responses: [],
      });
      prisma.quizAttempt.update = async ({ data }) => {
        savedMetricsStudentB = data.metrics;
        return { id: 'attempt-student-B', metrics: data.metrics };
      };

      const resB = createMockRes();
      await studentExamController.startExam(
        { user: { userId: 'student-B', role: 'STUDENT' }, params: { quizId: 'pool-quiz-1' } },
        resB,
        (err) => { if (err) throw err; }
      );
      assert.equal(resB.statusCode, 200);
      const questionsB = resB.body.data.quiz.questions;
      assert.equal(questionsB.length, 4);
      const idsB = new Set(questionsB.map((q) => q.id));
      assert.equal(idsB.size, 4);
    } finally {
      prisma.quiz.findUnique = origQuizFindUnique;
      prisma.user.findUnique = origUserFindUnique;
      prisma.quizAttempt.findFirst = origAttemptFindFirst;
      prisma.quizAttempt.create = origAttemptCreate;
      prisma.quizAttempt.update = origAttemptUpdate;
    }
  });
});
