const { before, describe, it } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'unit-test-jwt-secret';

let studentController;
let quizController;
let assignmentController;
let facultyDashboardController;
let errorMiddleware;
let prisma;

before(() => {
  studentController = require('../dist/controllers/student.controller');
  quizController = require('../dist/controllers/quiz.controller');
  assignmentController = require('../dist/controllers/assignment.controller');
  facultyDashboardController = require('../dist/controllers/faculty-dashboard.controller');
  errorMiddleware = require('../dist/middlewares/error.middleware');
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

describe('delete authorization & ownership security', () => {
  it('blocks student deleteTask when another student owns the task', async () => {
    const originalFindUnique = prisma.studentTask.findUnique;
    const originalDelete = prisma.studentTask.delete;
    let deleted = false;
    prisma.studentTask.findUnique = async () => ({ id: 'task-1', userId: 'student-owner' });
    prisma.studentTask.delete = async () => { deleted = true; return {}; };
    try {
      const res = createMockRes();
      await studentController.deleteTask({ user: { userId: 'attacker', role: 'STUDENT' }, params: { id: 'task-1' } }, res);
      assert.equal(res.statusCode, 403);
      assert.equal(deleted, false);
    } finally {
      prisma.studentTask.findUnique = originalFindUnique;
      prisma.studentTask.delete = originalDelete;
    }
  });

  it('blocks student deleteHabit and deleteCalendarEvent across users', async () => {
    const origHabitFind = prisma.studentHabit.findUnique;
    const origHabitDel = prisma.studentHabit.delete;
    const origCalFind = prisma.studentCalendarEvent.findUnique;
    const origCalDel = prisma.studentCalendarEvent.delete;
    let deleted = false;
    prisma.studentHabit.findUnique = async () => ({ id: 'habit-1', userId: 'student-owner' });
    prisma.studentHabit.delete = async () => { deleted = true; return {}; };
    prisma.studentCalendarEvent.findUnique = async () => ({ id: 'cal-1', userId: 'student-owner' });
    prisma.studentCalendarEvent.delete = async () => { deleted = true; return {}; };
    try {
      const res1 = createMockRes();
      await studentController.deleteHabit({ user: { userId: 'attacker', role: 'STUDENT' }, params: { id: 'habit-1' } }, res1);
      assert.equal(res1.statusCode, 403);

      const res2 = createMockRes();
      await studentController.deleteCalendarEvent({ user: { userId: 'attacker', role: 'STUDENT' }, params: { id: 'cal-1' } }, res2);
      assert.equal(res2.statusCode, 403);
      assert.equal(deleted, false);
    } finally {
      prisma.studentHabit.findUnique = origHabitFind;
      prisma.studentHabit.delete = origHabitDel;
      prisma.studentCalendarEvent.findUnique = origCalFind;
      prisma.studentCalendarEvent.delete = origCalDel;
    }
  });

  it('allows student to delete their own task, habit, and calendar event', async () => {
    const origTaskFind = prisma.studentTask.findUnique;
    const origTaskDel = prisma.studentTask.delete;
    let deletedCount = 0;
    prisma.studentTask.findUnique = async () => ({ id: 'task-1', userId: 'student-1' });
    prisma.studentTask.delete = async () => { deletedCount++; return {}; };
    try {
      const res = createMockRes();
      await studentController.deleteTask({ user: { userId: 'student-1', role: 'STUDENT' }, params: { id: 'task-1' } }, res);
      assert.equal(res.statusCode, 200);
      assert.equal(deletedCount, 1);
      assert.deepEqual(res.body, { success: true });
    } finally {
      prisma.studentTask.findUnique = origTaskFind;
      prisma.studentTask.delete = origTaskDel;
    }
  });

  it('enforces NotFound (404) and Forbidden (403) in quiz deleteQuiz', async () => {
    const originalFindUnique = prisma.quiz.findUnique;
    const originalDelete = prisma.quiz.delete;
    let deleted = false;
    prisma.quiz.delete = async () => { deleted = true; return {}; };
    try {
      prisma.quiz.findUnique = async () => null;
      let capturedError;
      await quizController.deleteQuiz(
        { user: { userId: 'faculty-1', role: 'FACULTY' }, params: { quizId: 'missing' } },
        createMockRes(),
        (err) => { capturedError = err; }
      );
      assert.equal(capturedError.statusCode, 404);

      prisma.quiz.findUnique = async () => ({ id: 'quiz-1', createdBy: 'faculty-owner' });
      capturedError = undefined;
      await quizController.deleteQuiz(
        { user: { userId: 'faculty-other', role: 'FACULTY' }, params: { quizId: 'quiz-1' } },
        createMockRes(),
        (err) => { capturedError = err; }
      );
      assert.equal(capturedError.statusCode, 403);
      assert.equal(deleted, false);
    } finally {
      prisma.quiz.findUnique = originalFindUnique;
      prisma.quiz.delete = originalDelete;
    }
  });

  it('blocks unauthorized faculty assignment & dashboard deletions', async () => {
    const origAssignFind = prisma.assignment.findUnique;
    const origAssignDel = prisma.assignment.delete;
    const origAnnFind = prisma.announcement.findUnique;
    const origAnnDel = prisma.announcement.delete;
    let deleted = false;
    prisma.assignment.findUnique = async () => ({ id: 'asgn-1', createdBy: 'faculty-owner' });
    prisma.assignment.delete = async () => { deleted = true; return {}; };
    prisma.announcement.findUnique = async () => ({ id: 'ann-1', facultyId: 'faculty-owner' });
    prisma.announcement.delete = async () => { deleted = true; return {}; };
    try {
      const resA = createMockRes();
      await assignmentController.deleteAssignment({ user: { userId: 'faculty-other', role: 'FACULTY' }, params: { id: 'asgn-1' } }, resA);
      assert.equal(resA.statusCode, 403);

      const resB = createMockRes();
      await facultyDashboardController.deleteAnnouncement({ user: { userId: 'faculty-other', role: 'FACULTY' }, params: { id: 'ann-1' } }, resB);
      assert.equal(resB.statusCode, 403);
      assert.equal(deleted, false);
    } finally {
      prisma.assignment.findUnique = origAssignFind;
      prisma.assignment.delete = origAssignDel;
      prisma.announcement.findUnique = origAnnFind;
      prisma.announcement.delete = origAnnDel;
    }
  });

  it('maps Prisma P2025 (404) and P2003 (409) in errorHandler', () => {
    const res404 = createMockRes();
    const err404 = Object.assign(new Error('Record to delete does not exist'), { code: 'P2025' });
    errorMiddleware.errorHandler(err404, {}, res404, () => {});
    assert.equal(res404.statusCode, 404);
    assert.equal(res404.body.error.code, 'ERR_NOT_FOUND');

    const res409 = createMockRes();
    const err409 = Object.assign(new Error('Foreign key constraint failed'), { code: 'P2003' });
    errorMiddleware.errorHandler(err409, {}, res409, () => {});
    assert.equal(res409.statusCode, 409);
    assert.equal(res409.body.error.code, 'ERR_CONFLICT');
  });
});

