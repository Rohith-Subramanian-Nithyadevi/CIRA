const test = require('node:test');
const assert = require('node:assert/strict');
const { generateQuizOtp, verifyQuizOtp, getOtpRemainingSeconds } = require('../dist/utils/totp.js');
const { verifyQuizAccessOtp, saveResponse, submitExam, startExam } = require('../dist/controllers/student-exam.controller.js');
const { toggleQuizEntryLock, getLiveQuizOtp } = require('../dist/controllers/quiz.controller.js');
const { prisma } = require('../dist/config/prisma.js');

test('30-Second Rotating Classroom OTP & Single-Session Device Lock', async (t) => {
  const quizId = 'quiz-otp-test-123';

  await t.test('TOTP generation and strict 30-second verification', () => {
    const liveOtp = generateQuizOtp(quizId);
    assert.equal(typeof liveOtp, 'string');
    assert.equal(liveOtp.length, 6);

    // Verify current OTP matches
    assert.equal(verifyQuizOtp(quizId, liveOtp), true);

    // Verify OTP with spaces formatted like "739 204"
    const spacedOtp = `${liveOtp.slice(0, 3)} ${liveOtp.slice(3)}`;
    assert.equal(verifyQuizOtp(quizId, spacedOtp), true);

    // Verify invalid OTP is rejected
    assert.equal(verifyQuizOtp(quizId, '000000'), false);
    assert.equal(verifyQuizOtp(quizId, '12345'), false);
    assert.equal(verifyQuizOtp(quizId, 'abcdef'), false);
  });

  await t.test('Faculty getLiveQuizOtp returns live OTP, countdown, and entryLocked state', async () => {
    const origFindUnique = prisma.quiz.findUnique;
    prisma.quiz.findUnique = async () => ({
      id: quizId,
      title: 'Operating Systems',
      subject: 'CS401',
      createdBy: 'fac-1',
      performanceBands: { entryLocked: false }
    });

    try {
      let status = 0;
      let jsonBody = null;
      const res = {
        status: (s) => { status = s; return res; },
        json: (b) => { jsonBody = b; return res; }
      };

      await getLiveQuizOtp({ params: { quizId }, user: { userId: 'fac-1', role: 'FACULTY' } }, res, (err) => { if (err) throw err; });

      assert.equal(status, 200);
      assert.equal(jsonBody.status, 'success');
      assert.equal(typeof jsonBody.data.otp, 'string');
      assert.equal(jsonBody.data.otp.length, 6);
      assert.equal(typeof jsonBody.data.remainingSeconds, 'number');
      assert.equal(jsonBody.data.entryLocked, false);
      assert.equal(jsonBody.data.stepSeconds, 30);
    } finally {
      prisma.quiz.findUnique = origFindUnique;
    }
  });

  await t.test('Faculty toggleQuizEntryLock toggles entryLocked flag', async () => {
    const origFindUnique = prisma.quiz.findUnique;
    const origUpdate = prisma.quiz.update;

    let updatedBands = null;
    prisma.quiz.findUnique = async () => ({
      id: quizId,
      createdBy: 'fac-1',
      performanceBands: { entryLocked: false }
    });
    prisma.quiz.update = async ({ data }) => {
      updatedBands = data.performanceBands;
      return { id: quizId, performanceBands: updatedBands };
    };

    try {
      let status = 0;
      let jsonBody = null;
      const res = {
        status: (s) => { status = s; return res; },
        json: (b) => { jsonBody = b; return res; }
      };

      await toggleQuizEntryLock(
        { params: { quizId }, body: { locked: true }, user: { userId: 'fac-1', role: 'FACULTY' } },
        res,
        (err) => { if (err) throw err; }
      );

      assert.equal(status, 200);
      assert.equal(jsonBody.data.entryLocked, true);
      assert.equal(updatedBands.entryLocked, true);
    } finally {
      prisma.quiz.findUnique = origFindUnique;
      prisma.quiz.update = origUpdate;
    }
  });

  await t.test('verifyQuizAccessOtp blocks student when faculty has locked classroom entry', async () => {
    const origFindUnique = prisma.quiz.findUnique;
    prisma.quiz.findUnique = async () => ({
      id: quizId,
      questions: [],
      questionUsages: [],
      performanceBands: { entryLocked: true }
    });

    try {
      let errorThrown = null;
      await verifyQuizAccessOtp(
        { params: { quizId }, body: { otp: generateQuizOtp(quizId) }, user: { userId: 'stu-1', role: 'STUDENT' } },
        {},
        (err) => { errorThrown = err; }
      );

      assert.ok(errorThrown);
      assert.equal(errorThrown.statusCode, 403);
      assert.equal(errorThrown.errorCode, 'ENTRY_LOCKED');
    } finally {
      prisma.quiz.findUnique = origFindUnique;
    }
  });

  await t.test('verifyQuizAccessOtp binds attempt to attemptSessionToken and reveals questions on valid OTP', async () => {
    const validOtp = generateQuizOtp(quizId);
    const origFindUnique = prisma.quiz.findUnique;
    const origFindFirst = prisma.quizAttempt.findFirst;
    const origUpdate = prisma.quizAttempt.update;

    prisma.quiz.findUnique = async () => ({
      id: quizId,
      title: 'Database Systems',
      questions: [
        { id: 'q1', text: 'What is ACID?', marks: 2, type: 'MCQ', options: ['A', 'B', 'C', 'D'] }
      ],
      questionUsages: [],
      performanceBands: { entryLocked: false }
    });

    let attemptInDb = {
      id: 'attempt-1',
      quizId,
      userId: 'stu-1',
      status: 'IN_PROGRESS',
      startTime: new Date(),
      metrics: {}
    };

    prisma.quizAttempt.findFirst = async () => attemptInDb;
    prisma.quizAttempt.update = async ({ data }) => {
      attemptInDb = { ...attemptInDb, metrics: data.metrics };
      return attemptInDb;
    };

    try {
      let status = 0;
      let jsonBody = null;
      const res = {
        set: () => {},
        status: (s) => { status = s; return res; },
        json: (b) => { jsonBody = b; return res; }
      };

      await verifyQuizAccessOtp(
        { params: { quizId }, body: { otp: validOtp }, user: { userId: 'stu-1', role: 'STUDENT' } },
        res,
        (err) => { if (err) throw err; }
      );

      assert.equal(status, 200);
      assert.equal(jsonBody.status, 'success');
      assert.equal(jsonBody.data.otpVerified, true);
      assert.ok(jsonBody.data.attemptSessionToken);
      assert.equal(jsonBody.data.quiz.questions.length, 1);
      assert.equal(jsonBody.data.quiz.questions[0].id, 'q1');
      assert.equal(attemptInDb.metrics.otpVerified, true);
      assert.equal(attemptInDb.metrics.attemptSessionToken, jsonBody.data.attemptSessionToken);
    } finally {
      prisma.quiz.findUnique = origFindUnique;
      prisma.quizAttempt.findFirst = origFindFirst;
      prisma.quizAttempt.update = origUpdate;
    }
  });

  await t.test('Single-Session Device Lock: rejects saveResponse and submitExam from a different device', async () => {
    const origFindUniqueAttempt = prisma.quizAttempt.findUnique;
    const sessionToken = 'legitimate-session-token-123';

    prisma.quizAttempt.findUnique = async () => ({
      id: 'attempt-1',
      quizId,
      userId: 'stu-1',
      status: 'IN_PROGRESS',
      metrics: {
        attemptSessionToken: sessionToken
      }
    });

    try {
      // 1. Try to save response with spoofed/different session token
      let saveError = null;
      await saveResponse(
        {
          params: { attemptId: 'attempt-1' },
          headers: { 'x-attempt-session-token': 'rogue-second-device' },
          body: { questionId: 'q1', answerData: 'A', attemptSessionToken: 'rogue-second-device' },
          user: { userId: 'stu-1', role: 'STUDENT' }
        },
        {},
        (err) => { saveError = err; }
      );

      assert.ok(saveError);
      assert.equal(saveError.statusCode, 403);
      assert.equal(saveError.errorCode, 'INVALID_SESSION_TOKEN');

      // 2. Try to submit exam with spoofed/different session token
      let submitError = null;
      await submitExam(
        {
          params: { attemptId: 'attempt-1' },
          headers: { 'x-attempt-session-token': 'rogue-second-device' },
          body: { attemptSessionToken: 'rogue-second-device' },
          user: { userId: 'stu-1', role: 'STUDENT' }
        },
        {},
        (err) => { submitError = err; }
      );

      assert.ok(submitError);
      assert.equal(submitError.statusCode, 403);
      assert.equal(submitError.errorCode, 'INVALID_SESSION_TOKEN');
    } finally {
      prisma.quizAttempt.findUnique = origFindUniqueAttempt;
    }
  });
});
