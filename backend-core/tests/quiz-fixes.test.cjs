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

describe('Quiz Targeted Fixes: Option Shuffling, Auto-Grading, and Obtained/Total Score Format', () => {
  const originalOptions = ['Alpha', 'Beta', 'Gamma', 'Delta'];
  const testQuestion = {
    id: 'q-mcq-1',
    type: 'MCQ',
    text: 'What is the first Greek letter?',
    marks: 5,
    negativeMarks: 1,
    options: [...originalOptions],
    answerKey: 'Alpha',
    quizId: 'quiz-shuffle-1',
    image: null,
  };

  it('shuffles options deterministically per student and preserves order on page reload', async () => {
    const origQuizFindUnique = prisma.quiz.findUnique;
    const origUserFindUnique = prisma.user.findUnique;
    const origAttemptFindFirst = prisma.quizAttempt.findFirst;
    const origAttemptCreate = prisma.quizAttempt.create;
    const origAttemptUpdate = prisma.quizAttempt.update;

    prisma.user.findUnique = async () => ({ departmentId: 'dept-1', sectionId: 'sec-1' });
    prisma.quizAttempt.update = async () => ({});

    prisma.quiz.findUnique = async () => ({
      id: 'quiz-shuffle-1',
      title: 'Shuffle Test Quiz',
      subject: 'Languages',
      paperStatus: 'PUBLISHED',
      totalMarks: 5,
      durationMinutes: 30,
      targetDepartments: [{ departmentId: 'dept-1' }],
      targetSections: [],
      targetStudents: [],
      questions: [{ ...testQuestion, options: [...originalOptions] }],
      questionUsages: [],
    });

    try {
      // 1. Student 1 starts exam
      prisma.quizAttempt.findFirst = async () => null;
      prisma.quizAttempt.create = async ({ data }) => ({
        id: 'attempt-s1',
        quizId: data.quizId,
        userId: 'student-1',
        status: 'IN_PROGRESS',
        startTime: new Date(),
        metrics: null,
        responses: [],
      });

      const resS1 = createMockRes();
      await studentExamController.startExam(
        { user: { userId: 'student-1', role: 'STUDENT' }, params: { quizId: 'quiz-shuffle-1' } },
        resS1,
        (err) => { if (err) throw err; }
      );

      assert.equal(resS1.statusCode, 200);
      const s1Options = resS1.body.data.quiz.questions[0].options;
      // All options are present
      assert.equal(s1Options.length, 4);
      assert.deepEqual([...s1Options].sort(), [...originalOptions].sort());

      // 2. Student 1 reloads the exam: options must remain in the EXACT same order
      prisma.quizAttempt.findFirst = async () => ({
        id: 'attempt-s1',
        quizId: 'quiz-shuffle-1',
        userId: 'student-1',
        status: 'IN_PROGRESS',
        startTime: new Date(),
        metrics: { questionOrder: ['q-mcq-1'] },
        responses: [],
      });

      const resS1Reload = createMockRes();
      await studentExamController.startExam(
        { user: { userId: 'student-1', role: 'STUDENT' }, params: { quizId: 'quiz-shuffle-1' } },
        resS1Reload,
        (err) => { if (err) throw err; }
      );
      assert.equal(resS1Reload.statusCode, 200);
      const s1ReloadOptions = resS1Reload.body.data.quiz.questions[0].options;
      assert.deepEqual(s1ReloadOptions, s1Options, 'Page reload must preserve identical shuffled option order');

      // 3. Student 2 starts exam: gets options deterministically for student-2
      prisma.quizAttempt.findFirst = async () => null;
      prisma.quizAttempt.create = async ({ data }) => ({
        id: 'attempt-s2',
        quizId: data.quizId,
        userId: 'student-2',
        status: 'IN_PROGRESS',
        startTime: new Date(),
        metrics: null,
        responses: [],
      });

      const resS2 = createMockRes();
      await studentExamController.startExam(
        { user: { userId: 'student-2', role: 'STUDENT' }, params: { quizId: 'quiz-shuffle-1' } },
        resS2,
        (err) => { if (err) throw err; }
      );
      assert.equal(resS2.statusCode, 200);
      const s2Options = resS2.body.data.quiz.questions[0].options;
      assert.equal(s2Options.length, 4);
      assert.deepEqual([...s2Options].sort(), [...originalOptions].sort());
    } finally {
      prisma.quiz.findUnique = origQuizFindUnique;
      prisma.user.findUnique = origUserFindUnique;
      prisma.quizAttempt.findFirst = origAttemptFindFirst;
      prisma.quizAttempt.create = origAttemptCreate;
      prisma.quizAttempt.update = origAttemptUpdate;
    }
  });

  it('correctly auto-grades answers with option text matching answerKey', () => {
    const question = {
      id: 'q-mcq-1',
      type: 'MCQ',
      marks: 4,
      negativeMarks: 1,
      options: ['Beta', 'Alpha', 'Delta', 'Gamma'],
      answerKey: 'Alpha',
    };

    // Correct option selected by string value
    const correctScore = studentExamController.gradeObjectiveResponse(question, {
      status: 'ANSWERED',
      answerData: 'Alpha',
    });
    assert.equal(correctScore, 4);

    // Incorrect option selected
    const incorrectScore = studentExamController.gradeObjectiveResponse(question, {
      status: 'ANSWERED',
      answerData: 'Beta',
    });
    assert.equal(incorrectScore, -1);

    // Unanswered response
    const unansweredScore = studentExamController.gradeObjectiveResponse(question, {
      status: 'NOT_VISITED',
      answerData: null,
    });
    assert.equal(unansweredScore, 0);

    // Multi-select question
    const multiQuestion = {
      id: 'q-ms-1',
      type: 'MULTI_SELECT',
      marks: 6,
      negativeMarks: 0,
      options: ['TCP', 'UDP', 'HTTP', 'FTP'],
      answerKey: ['HTTP', 'FTP'],
    };

    const multiCorrect = studentExamController.gradeObjectiveResponse(multiQuestion, {
      status: 'ANSWERED',
      answerData: ['FTP', 'HTTP'], // Shuffled order selected
    });
    assert.equal(multiCorrect, 6);
  });

  it('getQuizResult returns obtainedScore, totalMarks, and formatted obtainedScore / totalScore string', async () => {
    const origQuizFindUnique = prisma.quiz.findUnique;
    const origAttemptFindFirst = prisma.quizAttempt.findFirst;

    prisma.quiz.findUnique = async () => ({
      id: 'quiz-result-1',
      answersPublished: true,
    });

    prisma.quizAttempt.findFirst = async () => ({
      id: 'att-100',
      quizId: 'quiz-result-1',
      userId: 'student-1',
      status: 'SUBMITTED',
      totalScore: 6,
      objectiveScore: 6,
      writtenScore: 0,
      responses: [
        { id: 'r-1', questionId: 'q-1', answerData: 'Alpha', marksAwarded: 5, status: 'ANSWERED' },
      ],
      quiz: {
        id: 'quiz-result-1',
        title: 'Network Fundamentals',
        totalMarks: 10,
        answersPublished: true,
        questions: [
          { id: 'q-1', type: 'MCQ', text: 'Q1', marks: 5, answerKey: 'Alpha', options: ['Alpha', 'Beta'] },
          { id: 'q-2', type: 'MCQ', text: 'Q2', marks: 5, answerKey: 'Beta', options: ['Alpha', 'Beta'] },
        ],
        questionUsages: [],
      },
    });

    try {
      const res = createMockRes();
      await studentExamController.getQuizResult(
        { params: { quizId: 'quiz-result-1' }, user: { userId: 'student-1' } },
        res,
        (err) => { if (err) throw err; }
      );

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.status, 'success');
      assert.equal(res.body.data.obtainedScore, 6);
      assert.equal(res.body.data.totalMarks, 10);
      assert.equal(res.body.data.scoreFormatted, '6 / 10');
    } finally {
      prisma.quiz.findUnique = origQuizFindUnique;
      prisma.quizAttempt.findFirst = origAttemptFindFirst;
    }
  });
});
