const test = require('node:test');
const assert = require('node:assert/strict');
const {
  extractRowData,
  validateOfflineMarksheet,
  importOfflineMarksheet
} = require('../dist/controllers/offline-quiz.controller.js');
const { getQuizAnalytics } = require('../dist/controllers/faculty-reports.controller.js');
const { startExam } = require('../dist/controllers/student-exam.controller.js');
const { prisma } = require('../dist/config/prisma.js');

test('Offline Marksheet Import & Topic-Wise Analytics Integration', async (t) => {
  await t.test('extractRowData parses various column header formats', () => {
    const rawRow1 = {
      'Roll Number': '21CS042',
      'Student Name': 'Alice Smith',
      'Q1 (Arrays - 5)': '4',
      'Q2 (Trees - 10)': '9'
    };

    const parsedA = extractRowData(rawRow1, 'QUESTION_WISE', [
      { questionNumber: 1, topic: 'Arrays', maxMarks: 5 },
      { questionNumber: 2, topic: 'Trees', maxMarks: 10 }
    ]);

    assert.equal(parsedA.identifier, '21CS042');
    assert.equal(parsedA.studentName, 'Alice Smith');
    assert.equal(parsedA.questionScores['1'], 4);
    assert.equal(parsedA.questionScores['2'], 9);

    const rawRow2 = {
      'Email': 'bob@cira.edu',
      'Total Marks': '44'
    };
    const parsedB = extractRowData(rawRow2, 'TOTAL_ONLY');
    assert.equal(parsedB.identifier, 'bob@cira.edu');
    assert.equal(parsedB.totalScore, 44);
  });

  await t.test('validateOfflineMarksheet matches students and flags invalid/unmatched rows', async () => {
    const origFindMany = prisma.user.findMany;
    prisma.user.findMany = async () => [
      {
        id: 'stud-1',
        name: 'Alice Smith',
        email: 'alice@cira.edu',
        rollNumber: '21CS042',
        departmentId: 'dept-cs',
        sectionId: 'sec-a',
        department: { id: 'dept-cs', name: 'Computer Science' },
        section: { id: 'sec-a', name: 'A' }
      }
    ];

    try {
      let status = 0;
      let jsonBody = null;
      const res = {
        status: (s) => { status = s; return res; },
        json: (b) => { jsonBody = b; return res; }
      };

      const req = {
        user: { userId: 'fac-1', role: 'FACULTY' },
        facultyScope: null,
        body: {
          mode: 'QUESTION_WISE',
          totalMarks: 15,
          questions: [
            { questionNumber: 1, topic: 'Arrays', maxMarks: 5 },
            { questionNumber: 2, topic: 'Recursion', maxMarks: 10 }
          ],
          rows: [
            { identifier: '21CS042', questionScores: { '1': 4, '2': 8 } },
            { identifier: 'NONEXISTENT_ROLL', questionScores: { '1': 5, '2': 5 } },
            { identifier: 'alice@cira.edu', questionScores: { '1': 10, '2': 5 } } // Exceeds Q1 max marks and duplicate
          ]
        }
      };

      await validateOfflineMarksheet(req, res, (err) => { if (err) throw err; });

      assert.equal(status, 200);
      assert.equal(jsonBody.status, 'success');
      assert.equal(jsonBody.data.summary.totalRows, 3);
      assert.equal(jsonBody.data.summary.validRowsCount, 1);
      assert.equal(jsonBody.data.summary.invalidRowsCount, 2);

      // Row 1 should be matched and valid
      assert.equal(jsonBody.data.rows[0].matched, true);
      assert.equal(jsonBody.data.rows[0].errors.length, 0);
      assert.equal(jsonBody.data.rows[0].totalScore, 12);
      assert.equal(jsonBody.data.rows[0].band, 'EXCELLENT'); // 12/15 = 80%

      // Row 2 should be unmatched
      assert.equal(jsonBody.data.rows[1].matched, false);
      assert.match(jsonBody.data.rows[1].errors[0], /No registered student found/);

      // Row 3 should have score exceeding maxMarks error
      assert.equal(jsonBody.data.rows[2].errors.some(e => e.includes('exceeds question maximum')), true);
    } finally {
      prisma.user.findMany = origFindMany;
    }
  });

  await t.test('importOfflineMarksheet persists Quiz, Question stubs, and QuizAttempt with no proctoring violations', async () => {
    const origFindMany = prisma.user.findMany;
    const origTransaction = prisma.$transaction;

    prisma.user.findMany = async () => [
      {
        id: 'stud-1',
        name: 'Alice Smith',
        email: 'alice@cira.edu',
        rollNumber: '21CS042',
        departmentId: 'dept-cs',
        sectionId: 'sec-a'
      }
    ];

    let createdQuiz = null;
    const createdQuestions = [];
    const createdAttempts = [];
    const createdResponses = [];

    prisma.$transaction = async (callback) => {
      const mockTx = {
        quiz: {
          create: async ({ data }) => {
            createdQuiz = { id: 'quiz-offline-1', ...data };
            return createdQuiz;
          }
        },
        question: {
          create: async ({ data }) => {
            const q = { id: `q-${createdQuestions.length + 1}`, ...data };
            createdQuestions.push(q);
            return q;
          }
        },
        quizAttempt: {
          create: async ({ data }) => {
            const a = { id: `att-${createdAttempts.length + 1}`, ...data };
            createdAttempts.push(a);
            return a;
          }
        },
        quizResponse: {
          create: async ({ data }) => {
            const r = { id: `resp-${createdResponses.length + 1}`, ...data };
            createdResponses.push(r);
            return r;
          }
        }
      };
      return callback(mockTx);
    };

    try {
      let status = 0;
      let jsonBody = null;
      const res = {
        status: (s) => { status = s; return res; },
        json: (b) => { jsonBody = b; return res; }
      };

      const req = {
        user: { userId: 'fac-1', role: 'FACULTY' },
        facultyScope: null,
        body: {
          title: 'Midterm Exam (Paper)',
          subject: 'Data Structures',
          mode: 'QUESTION_WISE',
          totalMarks: 20,
          questions: [
            { questionNumber: 1, topic: 'Binary Trees', maxMarks: 10 },
            { questionNumber: 2, topic: 'Graphs', maxMarks: 10 }
          ],
          rows: [
            { identifier: '21CS042', questionScores: { '1': 8, '2': 7 } }
          ]
        }
      };

      await importOfflineMarksheet(req, res, (err) => { if (err) throw err; });

      assert.equal(status, 201);
      assert.equal(jsonBody.status, 'success');
      assert.equal(jsonBody.data.totalImported, 1);

      // Verify Quiz record
      assert.equal(createdQuiz.title, 'Midterm Exam (Paper)');
      assert.equal(createdQuiz.sourceType, 'OFFLINE');
      assert.equal(createdQuiz.hasQuestionBreakdown, true);
      assert.equal(createdQuiz.totalMarks, 20);

      // Verify Question stubs
      assert.equal(createdQuestions.length, 2);
      assert.equal(createdQuestions[0].topic, 'Binary Trees');
      assert.equal(createdQuestions[1].topic, 'Graphs');

      // Verify QuizAttempt
      assert.equal(createdAttempts.length, 1);
      assert.equal(createdAttempts[0].sourceType, 'OFFLINE');
      assert.equal(createdAttempts[0].status, 'EVALUATED');
      assert.equal(createdAttempts[0].totalScore, 15);
      assert.equal(createdAttempts[0].violationCount, undefined); // No proctoring violations generated!

      // Verify QuizResponses
      assert.equal(createdResponses.length, 2);
      assert.equal(createdResponses[0].marksAwarded, 8);
      assert.equal(createdResponses[1].marksAwarded, 7);
    } finally {
      prisma.user.findMany = origFindMany;
      prisma.$transaction = origTransaction;
    }
  });

  await t.test('getQuizAnalytics returns sourceType and hasQuestionBreakdown for offline quizzes', async () => {
    const origFindUnique = prisma.quiz.findUnique;
    const origFindMany = prisma.quizAttempt.findMany;

    prisma.quiz.findUnique = async () => ({
      id: 'quiz-offline-1',
      title: 'Class Test 1',
      totalMarks: 50,
      sourceType: 'OFFLINE',
      hasQuestionBreakdown: false,
      createdBy: 'fac-1',
      targetDepartments: [],
      targetSections: [],
      targetStudents: []
    });

    prisma.quizAttempt.findMany = async () => [
      {
        id: 'att-1',
        status: 'EVALUATED',
        totalScore: 45,
        score: 45,
        user: { id: 'u1', name: 'Alice', rollNumber: '21CS042', section: null, department: null },
        responses: []
      }
    ];

    try {
      let status = 0;
      let jsonBody = null;
      const res = {
        status: (s) => { status = s; return res; },
        json: (b) => { jsonBody = b; return res; }
      };

      await getQuizAnalytics({ params: { quizId: 'quiz-offline-1' }, query: {}, user: { role: 'FACULTY' }, facultyScope: null }, res, (err) => { if (err) throw err; });

      assert.equal(status, 200);
      assert.equal(jsonBody.data.quiz.sourceType, 'OFFLINE');
      assert.equal(jsonBody.data.quiz.hasQuestionBreakdown, false);
      assert.equal(jsonBody.data.leaderboard.length, 1);
      assert.equal(jsonBody.data.leaderboard[0].score, 90);
    } finally {
      prisma.quiz.findUnique = origFindUnique;
      prisma.quizAttempt.findMany = origFindMany;
    }
  });

  await t.test('startExam blocks students from starting online attempts for OFFLINE quizzes', async () => {
    const origFindUnique = prisma.quiz.findUnique;
    const origFindUser = prisma.user.findUnique;
    const origFindFirst = prisma.quizAttempt.findFirst;

    prisma.quizAttempt.findFirst = async () => null;

    prisma.quiz.findUnique = async () => ({
      id: 'quiz-offline-1',
      paperStatus: 'PUBLISHED',
      sourceType: 'OFFLINE',
      targetDepartments: [{ departmentId: 'dept-1' }],
      targetSections: [],
      targetStudents: []
    });

    prisma.user.findUnique = async () => ({
      id: 'stud-1',
      departmentId: 'dept-1',
      sectionId: 'sec-1'
    });

    try {
      let thrownError = null;
      const res = {
        set: () => res,
        status: () => res,
        json: () => res
      };

      await startExam({ params: { quizId: 'quiz-offline-1' }, user: { userId: 'stud-1' }, body: {} }, res, (err) => {
        thrownError = err;
      });

      assert.ok(thrownError, 'Expected startExam to throw an error');
      assert.match(thrownError.message, /conducted offline/i);
    } finally {
      prisma.quiz.findUnique = origFindUnique;
      prisma.user.findUnique = origFindUser;
      prisma.quizAttempt.findFirst = origFindFirst;
    }
  });
});
