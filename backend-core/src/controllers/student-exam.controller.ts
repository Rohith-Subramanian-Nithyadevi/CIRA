import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { BadRequestError, ForbiddenError, NotFoundError, UnauthorizedError } from '../utils/errors';
import { assertStudentOwnsAttempt } from '../utils/faculty-security';
import { resolveQuestionImages } from '../utils/object-storage';
import { verifyQuizOtp } from '../utils/totp';

export const OBJECTIVE_TYPES = ['MCQ', 'MULTI_SELECT', 'TRUE_FALSE', 'MATCHING', 'NUMERICAL', 'FILL_BLANK'];

export function gradeObjectiveResponse(
  question: any,
  response: { status?: string | null; answerData?: any }
): number | null {
  if (!question || !OBJECTIVE_TYPES.includes(question.type)) return null;
  if (question.answerKey === null || question.answerKey === undefined) return null;
  const isAnswered =
    response.status === 'ANSWERED' ||
    response.status === 'ANSWERED_AND_MARKED_FOR_REVIEW';
  if (!isAnswered) return 0;
  const isCorrect = isObjectiveAnswerCorrect(question, response.answerData);
  return isCorrect ? Number(question.marks || 0) : -Number(question.negativeMarks || 0);
}

export function isObjectiveAnswerCorrect(question: any, answerData: any): boolean {
  if (!question || question.answerKey === null || question.answerKey === undefined) return false;
  if (answerData === null || answerData === undefined || answerData === '') return false;

  if (question.type === 'NUMERICAL') {
    return Number(answerData) === Number(question.answerKey);
  }

  if (question.type === 'MATCHING') {
    if (Array.isArray(answerData) && Array.isArray(question.answerKey)) {
      const normalizePairs = (arr: any[]) =>
        arr.map((item: any) => ({
          left: String(item.left || '').trim().toLowerCase(),
          right: String(item.right || '').trim().toLowerCase()
        })).sort((a: any, b: any) => a.left.localeCompare(b.left));
      return JSON.stringify(normalizePairs(answerData)) === JSON.stringify(normalizePairs(question.answerKey));
    }
    return JSON.stringify(answerData) === JSON.stringify(question.answerKey);
  }

  if (question.type === 'MULTI_SELECT') {
    if (Array.isArray(answerData) && Array.isArray(question.answerKey)) {
      return JSON.stringify([...answerData].sort()) === JSON.stringify([...question.answerKey].sort());
    }
    return JSON.stringify(answerData) === JSON.stringify(question.answerKey);
  }

  if (question.type === 'FILL_BLANK') {
    const normalize = (val: any) => String(val ?? '').trim().toLowerCase();
    const key = question.answerKey;
    if (Array.isArray(key)) {
      if (Array.isArray(answerData)) {
        if (answerData.length !== key.length) return false;
        return key.every((expected: any, idx: number) => {
          const studentVal = normalize(answerData[idx]);
          if (Array.isArray(expected)) {
            return expected.some((ans: any) => normalize(ans) === studentVal);
          }
          const expectedOptions = String(expected).split(',').map(s => normalize(s));
          return expectedOptions.includes(studentVal);
        });
      }
      const studentVal = normalize(answerData);
      return key.some((variant: any) => normalize(variant) === studentVal);
    }
    const studentVal = normalize(answerData);
    const expectedList = String(key).split(',').map(s => normalize(s));
    return expectedList.includes(studentVal);
  }

  return answerData === question.answerKey;
}

// Get eligible quizzes for the logged-in student
export const getEligibleQuizzes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) throw new BadRequestError('User not authenticated', 'UNAUTHORIZED');

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { department: true, section: true }
    });

    if (!user) throw new BadRequestError('User not found', 'NOT_FOUND');

    const now = new Date();

    // Find quizzes targeting user's department, section, or specifically the user
    // Also ensure the quiz is currently active (start <= now, end >= now or no end date)
    const quizzes = await prisma.quiz.findMany({
      where: {
        AND: [
          { paperStatus: 'PUBLISHED' },
          {
            OR: [
              { targetDepartments: { some: { departmentId: user.departmentId || '' } } },
              { targetSections: { some: { sectionId: user.sectionId || '' } } },
              { targetStudents: { some: { userId: user.id } } }
            ]
          },
          {
            OR: [
              { endDate: null },
              { endDate: { gte: now } }
            ]
          },
          {
            OR: [
              { startDate: null },
              { startDate: { lte: now } }
            ]
          }
        ]
      },
      include: {
        attempts: {
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    // Redact score/evaluation data from student eligible quiz attempts until answers are published
    const sanitizedQuizzes = quizzes.map((quiz) => ({
      ...quiz,
      attempts: quiz.attempts.map((attempt) =>
        quiz.answersPublished
          ? attempt
          : {
              id: attempt.id,
              quizId: attempt.quizId,
              userId: attempt.userId,
              status: attempt.status,
              violationReason: attempt.violationReason,
              restartAuthorized: Boolean((attempt as any).restartAuthorized),
              startTime: attempt.startTime,
              endTime: attempt.endTime
            }
      )
    }));

    res.set?.('Cache-Control', 'no-store');
    res.status(200).json({ status: 'success', data: sanitizedQuizzes });
  } catch (error) {
    next(error);
  }
};

// Get read-only quiz instructions & validate student eligibility without creating an attempt
export const getQuizInstructions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quizId = req.params.quizId as string;
    const userId = (req as any).user?.userId;
    if (!userId) throw new UnauthorizedError('User not authenticated', 'UNAUTHORIZED');

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        targetDepartments: true,
        targetSections: true,
        targetStudents: true,
        questions: { select: { id: true } },
        questionUsages: { where: { isFinalized: true }, select: { questionId: true } }
      }
    });

    if (!quiz) throw new NotFoundError('Quiz not found', 'NOT_FOUND');

    const student = await prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true, sectionId: true }
    });

    const targeted =
      quiz.targetDepartments.some((target) => target.departmentId === student?.departmentId) ||
      quiz.targetSections.some((target) => target.sectionId === student?.sectionId) ||
      quiz.targetStudents.some((target) => target.userId === userId);

    if (quiz.paperStatus !== 'PUBLISHED' || !targeted) {
      throw new ForbiddenError('This assessment is not available to your class.', 'FORBIDDEN');
    }

    const attempt = await prisma.quizAttempt.findFirst({
      where: { quizId, userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        startTime: true,
        violationCount: true,
        violationReason: true,
        restartAuthorized: true
      }
    });

    if (attempt) {
      if (attempt.status === 'VIOLATED' && !attempt.restartAuthorized) {
        throw new ForbiddenError(
          'You have violated the quiz rules. Your quiz attempt has been locked. Please contact your faculty member if you require permission to restart.',
          'ATTEMPT_LOCKED'
        );
      }
      if (attempt.status !== 'IN_PROGRESS' && !attempt.restartAuthorized) {
        throw new BadRequestError('You have already submitted this quiz.', 'ALREADY_SUBMITTED');
      }
      if (attempt.status === 'IN_PROGRESS') {
        const durationSeconds = (quiz.durationMinutes || 60) * 60;
        const elapsedSeconds = (Date.now() - new Date(attempt.startTime).getTime()) / 1000;
        if (elapsedSeconds >= durationSeconds) {
          await prisma.quizAttempt.update({
            where: { id: attempt.id },
            data: { status: 'SUBMITTED', endTime: new Date(), violationReason: 'Quiz time expired' }
          });
          throw new BadRequestError(
            'Your quiz time has expired and your attempt has been submitted.',
            'ALREADY_SUBMITTED'
          );
        }
      }
    } else {
      const now = new Date();
      if (quiz.startDate && quiz.startDate > now) {
        throw new BadRequestError('Exam has not started yet', 'NOT_STARTED');
      }
      if (quiz.endDate && quiz.endDate < now) {
        throw new BadRequestError('Exam has already ended', 'EXPIRED');
      }
    }

    const questionIds = new Set([
      ...quiz.questions.map((q) => q.id),
      ...quiz.questionUsages.map((u) => u.questionId)
    ]);
    const poolCount = Number((quiz as any).performanceBands?.questionPoolCount);
    const totalPoolQuestions = questionIds.size;
    const isPoolSubset = poolCount > 0 && poolCount < totalPoolQuestions;
    const effectiveQuestionCount = isPoolSubset ? poolCount : totalPoolQuestions;

    res.set?.('Cache-Control', 'no-store');
    res.status(200).json({
      status: 'success',
      data: {
        quiz: {
          id: quiz.id,
          title: quiz.title,
          subject: quiz.subject,
          description: quiz.description,
          totalMarks: quiz.totalMarks,
          passingMarks: quiz.passingMarks,
          durationMinutes: quiz.durationMinutes,
          maxViolations: 1,
          hasActiveAttempt: Boolean(attempt),
          violationCount: attempt?.violationCount ?? 0,
          startDate: quiz.startDate,
          endDate: quiz.endDate,
          questionCount: effectiveQuestionCount,
          totalPoolQuestions: isPoolSubset ? totalPoolQuestions : undefined,
          isPoolSubset
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Start or Resume Exam
export const startExam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quizId = req.params.quizId as string;
    const userId = (req as any).user?.userId;

    // Check if latest attempt exists
    let attempt = await prisma.quizAttempt.findFirst({
      where: { quizId, userId },
      orderBy: { createdAt: 'desc' },
      include: {
        responses: true
      }
    });

    // Check quiz schedule before allowing new attempt
    const quizMetadata = await prisma.quiz.findUnique({ where: { id: quizId }, include: { targetDepartments: true, targetSections: true, targetStudents: true } });
    if (!quizMetadata) throw new BadRequestError('Quiz not found', 'NOT_FOUND');
    const student = await prisma.user.findUnique({ where: { id: userId }, select: { departmentId: true, sectionId: true } });
    const targeted = quizMetadata.targetDepartments.some((target) => target.departmentId === student?.departmentId) || quizMetadata.targetSections.some((target) => target.sectionId === student?.sectionId) || quizMetadata.targetStudents.some((target) => target.userId === userId);
    if (quizMetadata.paperStatus !== 'PUBLISHED' || !targeted) throw new ForbiddenError('This assessment is not available to your class.', 'FORBIDDEN');
    
    if (attempt) {
      if (attempt.status === 'VIOLATED' && !attempt.restartAuthorized) {
        throw new ForbiddenError(
          'You have violated the quiz rules. Your quiz attempt has been locked. Please contact your faculty member if you require permission to restart.',
          'ATTEMPT_LOCKED'
        );
      }

      if (attempt.status !== 'IN_PROGRESS' && !attempt.restartAuthorized) {
        throw new BadRequestError('Exam already submitted', 'FORBIDDEN');
      }

      if (attempt.restartAuthorized) {
        const now = new Date();
        if (quizMetadata.startDate && quizMetadata.startDate > now) {
          throw new BadRequestError('Exam has not started yet', 'FORBIDDEN');
        }
        if (quizMetadata.endDate && quizMetadata.endDate < now) {
          throw new BadRequestError('Exam has already ended', 'FORBIDDEN');
        }

        const priorAttemptId = attempt.id;
        attempt = await prisma.$transaction(async (tx) => {
          const consumed = await tx.quizAttempt.updateMany({
            where: { id: priorAttemptId, restartAuthorized: true },
            data: { restartAuthorized: false },
          });
          if (consumed.count === 0) {
            throw new ForbiddenError('Restart authorization has already been consumed.', 'FORBIDDEN');
          }
          return tx.quizAttempt.create({
            data: {
              quizId,
              userId,
              status: 'IN_PROGRESS',
              startTime: new Date(),
              violationCount: 0,
              restartAuthorized: false,
            },
            include: {
              responses: true,
            },
          });
        });
      } else {
        const durationSeconds = (quizMetadata.durationMinutes || 60) * 60;
        const elapsedSeconds = (Date.now() - new Date(attempt.startTime).getTime()) / 1000;
        if (elapsedSeconds >= durationSeconds) {
          await prisma.quizAttempt.update({
            where: { id: attempt.id },
            data: { status: 'SUBMITTED', endTime: new Date(), violationReason: 'Quiz time expired' }
          });
          throw new BadRequestError('Your quiz time has expired and your attempt has been submitted.', 'EXPIRED');
        }
      }
    } else {
      const now = new Date();
      if (quizMetadata.startDate && quizMetadata.startDate > now) {
        throw new BadRequestError('Exam has not started yet', 'FORBIDDEN');
      }
      if (quizMetadata.endDate && quizMetadata.endDate < now) {
        throw new BadRequestError('Exam has already ended', 'FORBIDDEN');
      }

      // Create new attempt
      attempt = await prisma.quizAttempt.create({
        data: {
          quizId,
          userId,
          status: 'IN_PROGRESS',
          startTime: new Date()
        },
        include: {
          responses: true
        }
      });
    }

    // Fetch quiz questions (without answers if we want to be secure, but we'll fetch full for simplicity in this MVP)
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          select: { id: true, type: true, text: true, marks: true, negativeMarks: true, options: true, quizId: true, image: true } // Exclude answerKey
        },
        questionUsages: { where: { isFinalized: true }, include: { question: { select: { id: true, type: true, text: true, marks: true, negativeMarks: true, options: true, image: true } } }, orderBy: { sortOrder: 'asc' } }
      }
    });

    if (quiz) {
      const usedIds = new Set(quiz.questions.map((question: any) => question.id));
      const paperQuestions = quiz.questionUsages.filter((usage: any) => !usedIds.has(usage.questionId)).map((usage: any) => ({ ...usage.question, marks: usage.marks, quizId }));
      quiz.questions = [...quiz.questions, ...paperQuestions] as any;
      delete (quiz as any).questionUsages;
    }
    if (quiz && quiz.questions) {
      quiz.questions = await resolveQuestionImages(quiz.questions.map((q: any) => {
        if (q.type === 'MATCHING' && Array.isArray(q.options)) {
          const lefts = q.options.map((o: any) => o.left);
          const rights = q.options.map((o: any) => o.right).sort(() => Math.random() - 0.5);
          q.options = { lefts, rights };
        }
        return q;
      }));

      // Question Shuffling & Pool Sampling:
      // Randomize question order per student attempt and select only a subset if questionPoolCount is configured
      const attemptMetrics = (attempt.metrics && typeof attempt.metrics === 'object' ? attempt.metrics : {}) as Record<string, any>;
      const poolCount = Number((quiz as any).performanceBands?.questionPoolCount);
      let orderedQuestions: any[] = [];

      if (Array.isArray(attemptMetrics.questionOrder) && attemptMetrics.questionOrder.length > 0) {
        // Attempt already has its assigned question subset & order: restore exactly that subset & sequence
        const orderMap = new Map(attemptMetrics.questionOrder.map((id: string, idx: number) => [id, idx]));
        orderedQuestions = quiz.questions.filter((q: any) => orderMap.has(q.id));
        orderedQuestions.sort((a: any, b: any) => {
          const idxA = orderMap.get(a.id)!;
          const idxB = orderMap.get(b.id)!;
          return idxA - idxB;
        });
      } else if (quiz.questions.length > 0) {
        // First time starting: seed deterministic PRNG for this student attempt
        const seedStr = `${attempt.id}-${userId}-${quizId}`;
        let hash = 0;
        for (let i = 0; i < seedStr.length; i++) {
          hash = (hash << 5) - hash + seedStr.charCodeAt(i);
          hash |= 0;
        }
        const pseudoRandom = () => {
          hash = Math.imul(hash ^ (hash >>> 15), 1 | hash);
          hash = (hash + Math.imul(hash ^ (hash >>> 7), 61 | hash)) ^ hash;
          return ((hash ^ (hash >>> 14)) >>> 0) / 4294967296;
        };

        // Clone unique pool questions
        const pool = [...quiz.questions];

        // Fisher-Yates uniform shuffle of the full question pool
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(pseudoRandom() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }

        // If pool subset count is configured (and less than total pool questions), take exactly that many!
        if (poolCount > 0 && poolCount < pool.length) {
          orderedQuestions = pool.slice(0, poolCount);
        } else {
          orderedQuestions = pool;
        }

        const questionOrder = orderedQuestions.map((q: any) => q.id);
        attemptMetrics.questionOrder = questionOrder;
        attemptMetrics.isPoolSubset = poolCount > 0 && poolCount < pool.length;
        attemptMetrics.poolTotalQuestions = pool.length;
        attemptMetrics.assignedQuestionCount = orderedQuestions.length;

        if (typeof prisma.quizAttempt?.update === 'function') {
          await prisma.quizAttempt.update({
            where: { id: attempt.id },
            data: { metrics: attemptMetrics },
          });
        }
      } else {
        orderedQuestions = [];
      }

      // If pool subset is active, recalculate quiz totalMarks for this student attempt
      if (orderedQuestions.length > 0 && poolCount > 0 && poolCount < quiz.questions.length) {
        const studentMarks = orderedQuestions.reduce((sum: number, q: any) => sum + (Number(q.marks) || 0), 0);
        quiz.totalMarks = studentMarks;
      }
      quiz.questions = orderedQuestions;
    }

    res.set?.('Cache-Control', 'no-store');
    res.status(200).json({ status: 'success', data: { attempt, quiz } });
  } catch (error) {
    next(error);
  }
};

// Save a single response (Auto-save)
export const saveResponse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attemptId = req.params.attemptId as string;
    const { questionId, answerData, status } = req.body; // status is ResponseStatus enum

    const attempt = await prisma.quizAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt) {
      throw new BadRequestError('Invalid or submitted attempt', 'FORBIDDEN');
    }
    if (attempt.status === 'VIOLATED') {
      throw new ForbiddenError('Your quiz attempt has been locked due to a security violation.', 'ATTEMPT_LOCKED');
    }
    if (attempt.status !== 'IN_PROGRESS') {
      throw new BadRequestError('Invalid or submitted attempt', 'FORBIDDEN');
    }

    const currentUser = (req as any).user;
    assertStudentOwnsAttempt(currentUser, attempt);

    // Cross-quiz validation: verify questionId strictly belongs to the quiz of this attempt
    const question = await prisma.question.findFirst({
      where: {
        id: questionId,
        OR: [{ quizId: attempt.quizId }, { usages: { some: { quizId: attempt.quizId } } }]
      },
      select: { id: true }
    });

    if (!question) {
      throw new BadRequestError('This question does not belong to the active quiz attempt.', 'INVALID_QUESTION_REFERENCE');
    }

    const response = await prisma.quizResponse.upsert({
      where: { attemptId_questionId: { attemptId, questionId } },
      update: {
        answerData: answerData || null,
        status: status || 'ANSWERED',
        savedAt: new Date()
      },
      create: {
        attemptId,
        questionId,
        answerData: answerData || null,
        status: status || 'ANSWERED',
        savedAt: new Date()
      }
    });

    res.set?.('Cache-Control', 'no-store');
    res.status(200).json({ status: 'success', data: response });
  } catch (error) {
    next(error);
  }
};

const VALID_VIOLATION_TYPES = new Set([
  'TAB_SWITCH',
  'WINDOW_BLUR',
  'FULLSCREEN_EXIT',
  'BLOCKED_KEY',
  'CLIPBOARD',
]);

async function finalizeAttemptSubmission(
  attempt: any,
  violationReason?: string | null,
  violationCount?: number,
  targetStatus: 'SUBMITTED' | 'VIOLATED' = 'SUBMITTED'
) {
  const usedQuestionIds = new Set(attempt.quiz.questions.map((question: any) => question.id));
  const gradingQuestions = [
    ...attempt.quiz.questions,
    ...attempt.quiz.questionUsages
      .filter((usage: any) => !usedQuestionIds.has(usage.questionId))
      .map((usage: any) => ({ ...usage.question, marks: usage.marks })),
  ];
  let objectiveScore = 0;

  const responseUpdates: { id: string; marksAwarded: number }[] = [];
  for (const response of attempt.responses) {
    if (response.status === 'ANSWERED' || response.status === 'ANSWERED_AND_MARKED_FOR_REVIEW') {
      const question = gradingQuestions.find((q: any) => q.id === response.questionId);
      if (question) {
        const awarded = gradeObjectiveResponse(question, response);
        if (awarded !== null) {
          objectiveScore += awarded;
          responseUpdates.push({ id: response.id, marksAwarded: awarded });
        }
      }
    }
  }

  return prisma.$transaction(async (tx) => {
    for (const upd of responseUpdates) {
      await tx.quizResponse.update({
        where: { id: upd.id },
        data: { marksAwarded: upd.marksAwarded }
      });
    }

    return tx.quizAttempt.update({
      where: { id: attempt.id },
      data: {
        status: targetStatus,
        endTime: new Date(),
        objectiveScore,
        totalScore: objectiveScore, // Written score is 0 until graded
        violationReason: violationReason || attempt.violationReason || null,
        restartAuthorized: false,
        ...(typeof violationCount === 'number' ? { violationCount } : {})
      }
    });
  });
}

const VALID_SHORTCUT_EVENT_TYPES = new Set([
  'keydown',
  'keyup',
  'blur',
  'visibilitychange',
  'fullscreenchange',
]);

const VALID_TRIGGER_EVENTS = new Set([
  'keydown',
  'keyup',
  'blur',
  'visibilitychange',
  'fullscreenchange',
  'clipboard',
]);

const VALID_CAPTURE_REASONS = new Set([
  'BLOCKED_SHORTCUT',
  'FOCUS_LOST',
  'VISIBILITY_HIDDEN',
  'FULLSCREEN_EXIT',
  'CLIPBOARD',
]);

const SAFE_KEY_LABEL_REGEX = /^[A-Za-z0-9 +\/_-]{1,32}$/;
const SAFE_CODE_REGEX = /^[A-Za-z0-9_]{1,32}$/;

const sanitizeShortString = (value: unknown, maxLen: number): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
};

const sanitizeIsoTimestamp = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
};

export function sanitizeViolationMetadata(rawMetadata: unknown): Record<string, unknown> {
  if (!rawMetadata || typeof rawMetadata !== 'object' || Array.isArray(rawMetadata)) {
    return {};
  }

  const input = rawMetadata as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  const visibilityState = sanitizeShortString(input.visibilityState, 24);
  if (visibilityState) sanitized.visibilityState = visibilityState;

  const recentKey = sanitizeShortString(input.recentKey, 64);
  if (recentKey) sanitized.recentKey = recentKey;

  const key = sanitizeShortString(input.key, 64);
  if (key) sanitized.key = key;

  const action = sanitizeShortString(input.action, 24);
  if (action) sanitized.action = action;

  const rawEvidence = input.shortcutEvidence;
  if (rawEvidence && typeof rawEvidence === 'object' && !Array.isArray(rawEvidence)) {
    const ev = rawEvidence as Record<string, unknown>;
    const rawEvents = Array.isArray(ev.events) ? ev.events.slice(0, 25) : [];
    const events = rawEvents
      .map((item: unknown) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
        const entry = item as Record<string, unknown>;
        if (typeof entry.eventType !== 'string' || !VALID_SHORTCUT_EVENT_TYPES.has(entry.eventType)) {
          return null;
        }
        const timestamp = sanitizeIsoTimestamp(entry.timestamp);
        if (!timestamp) return null;

        const modifiersObj =
          entry.modifiers && typeof entry.modifiers === 'object' && !Array.isArray(entry.modifiers)
            ? (entry.modifiers as Record<string, unknown>)
            : {};

        const safeKey =
          typeof entry.key === 'string' && SAFE_KEY_LABEL_REGEX.test(entry.key.trim())
            ? entry.key.trim()
            : undefined;
        const safeCode =
          typeof entry.code === 'string' && SAFE_CODE_REGEX.test(entry.code.trim())
            ? entry.code.trim()
            : undefined;

        const relativeMs =
          typeof entry.relativeMs === 'number' && Number.isFinite(entry.relativeMs)
            ? Math.max(-5000, Math.min(5000, Math.round(entry.relativeMs)))
            : undefined;

        return {
          eventType: entry.eventType,
          ...(safeKey ? { key: safeKey } : {}),
          ...(safeCode ? { code: safeCode } : {}),
          modifiers: {
            ctrl: Boolean(modifiersObj.ctrl),
            alt: Boolean(modifiersObj.alt),
            shift: Boolean(modifiersObj.shift),
            meta: Boolean(modifiersObj.meta),
          },
          timestamp,
          ...(relativeMs !== undefined ? { relativeMs } : {}),
        };
      })
      .filter(Boolean);

    const captureDurationMs =
      typeof ev.captureDurationMs === 'number' && Number.isFinite(ev.captureDurationMs)
        ? Math.max(0, Math.min(10000, Math.round(ev.captureDurationMs)))
        : 0;

    sanitized.shortcutEvidence = {
      triggeringEvent:
        typeof ev.triggeringEvent === 'string' && VALID_TRIGGER_EVENTS.has(ev.triggeringEvent)
          ? ev.triggeringEvent
          : null,
      captureReason:
        typeof ev.captureReason === 'string' && VALID_CAPTURE_REASONS.has(ev.captureReason)
          ? ev.captureReason
          : null,
      detectedSequence: sanitizeShortString(ev.detectedSequence, 120),
      summary: sanitizeShortString(ev.summary, 200),
      evidenceQuality: ev.evidenceQuality === 'COMPLETE' ? 'COMPLETE' : 'PARTIAL',
      focusLost: Boolean(ev.focusLost),
      visibilityHidden: Boolean(ev.visibilityHidden),
      captureStartedAt: sanitizeIsoTimestamp(ev.captureStartedAt),
      captureEndedAt: sanitizeIsoTimestamp(ev.captureEndedAt),
      captureDurationMs,
      events,
    };
  }

  return sanitized;
}

// Record a monitored security violation and immediately lock the active attempt as VIOLATED
export const recordViolation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attemptId = req.params.attemptId as string;
    const { type, reason, metadata, timestamp } = req.body ?? {};

    if (!type || !VALID_VIOLATION_TYPES.has(type)) {
      throw new BadRequestError('Invalid violation type', 'INVALID_VIOLATION_TYPE');
    }

    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        responses: true,
        quiz: { include: { questions: true, questionUsages: { where: { isFinalized: true }, include: { question: true } } } }
      }
    });

    if (!attempt) throw new BadRequestError('Attempt not found', 'NOT_FOUND');
    assertStudentOwnsAttempt((req as any).user, attempt);

    const maxViolations = 1;
    if (attempt.status !== 'IN_PROGRESS') {
      res.set?.('Cache-Control', 'no-store');
      res.status(200).json({
        status: 'success',
        data: {
          status: attempt.status,
          violationCount: attempt.violationCount ?? 0,
          maxViolations,
          autoSubmitted: true,
          locked: attempt.status === 'VIOLATED',
          deduplicated: true,
        }
      });
      return;
    }

    const nextCount = (attempt.violationCount ?? 0) + 1;
    const summaryReason = reason ? `${type}: ${reason}` : type;
    const finalReason = `${summaryReason} (${nextCount}/${maxViolations} violations)`;

    const usedQuestionIds = new Set(attempt.quiz.questions.map((question: any) => question.id));
    const gradingQuestions = [
      ...attempt.quiz.questions,
      ...attempt.quiz.questionUsages
        .filter((usage: any) => !usedQuestionIds.has(usage.questionId))
        .map((usage: any) => ({ ...usage.question, marks: usage.marks })),
    ];
    let objectiveScore = 0;
    const responseUpdates: { id: string; marksAwarded: number }[] = [];
    for (const response of attempt.responses) {
      if (response.status === 'ANSWERED' || response.status === 'ANSWERED_AND_MARKED_FOR_REVIEW') {
        const question = gradingQuestions.find((q: any) => q.id === response.questionId);
        if (question) {
          const awarded = gradeObjectiveResponse(question, response);
          if (awarded !== null) {
            objectiveScore += awarded;
            responseUpdates.push({ id: response.id, marksAwarded: awarded });
          }
        }
      }
    }

    const lockResult = await prisma.$transaction(async (tx) => {
      // Atomic guard: only the first concurrent violation locks the IN_PROGRESS attempt
      const updated = await tx.quizAttempt.updateMany({
        where: { id: attemptId, status: 'IN_PROGRESS' },
        data: {
          status: 'VIOLATED',
          endTime: new Date(),
          objectiveScore,
          totalScore: objectiveScore,
          violationCount: nextCount,
          violationReason: finalReason,
          restartAuthorized: false,
        }
      });

      if (updated.count === 0) {
        return { lockedNow: false };
      }

      for (const upd of responseUpdates) {
        await tx.quizResponse.update({
          where: { id: upd.id },
          data: { marksAwarded: upd.marksAwarded }
        });
      }

      const sanitizedMetadata = sanitizeViolationMetadata(metadata);
      const clientTimestamp = sanitizeIsoTimestamp(timestamp);

      await tx.quizViolation.create({
        data: {
          attemptId,
          quizId: attempt.quizId,
          userId: attempt.userId,
          type,
          reason: reason || null,
          metadata: {
            ...sanitizedMetadata,
            ...(clientTimestamp ? { clientTimestamp } : {}),
            violationNumber: nextCount,
          },
        }
      });

      return { lockedNow: true };
    });

    res.set?.('Cache-Control', 'no-store');
    res.status(200).json({
      status: 'success',
      data: {
        status: 'VIOLATED',
        violationCount: lockResult.lockedNow ? nextCount : (attempt.violationCount ?? 1),
        maxViolations,
        autoSubmitted: true,
        locked: true,
        deduplicated: !lockResult.lockedNow,
      }
    });
  } catch (error) {
    next(error);
  }
};

// Submit Exam and Auto-evaluate objective questions
export const submitExam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attemptId = req.params.attemptId as string;
    const { violationReason } = req.body ?? {}; // Optional: if submitted due to violation
    
    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        responses: true,
        quiz: { include: { questions: true, questionUsages: { where: { isFinalized: true }, include: { question: true } } } }
      }
    });

    if (!attempt) throw new BadRequestError('Attempt not found', 'NOT_FOUND');
    if (attempt.status === 'VIOLATED') {
      throw new ForbiddenError('Your quiz attempt has been locked due to a security violation.', 'ATTEMPT_LOCKED');
    }
    if (attempt.status !== 'IN_PROGRESS') throw new BadRequestError('Exam already submitted', 'FORBIDDEN');

    assertStudentOwnsAttempt((req as any).user, attempt);

    const updated = await finalizeAttemptSubmission(
      attempt,
      violationReason,
      violationReason ? (attempt.violationCount ?? 0) + 1 : undefined,
      violationReason ? 'VIOLATED' : 'SUBMITTED'
    );

    res.set?.('Cache-Control', 'no-store');
    res.status(200).json({
      status: 'success',
      message: 'Quiz submitted successfully',
      data: attempt.quiz.answersPublished
        ? updated
        : {
            id: updated.id,
            quizId: updated.quizId,
            status: updated.status,
            startTime: updated.startTime,
            endTime: updated.endTime
          }
    });
  } catch (error) {
    next(error);
  }
};

// Faculty: Authorize a student to restart a quiz while preserving previous attempt & violation records
export const allowRestart = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attemptId = req.params.attemptId as string;

    const attempt = await prisma.quizAttempt.findUnique({ 
      where: { id: attemptId },
      include: { quiz: true }
    });
    if (!attempt) throw new BadRequestError('Attempt not found', 'NOT_FOUND');

    // Authorization check: only ADMIN or the quiz creator can authorize a restart
    if (req.user?.role !== 'ADMIN' && attempt.quiz.createdBy !== req.user?.userId) {
      throw new UnauthorizedError('Not authorized to modify attempts for this quiz', 'UNAUTHORIZED');
    }

    const updated = await prisma.quizAttempt.update({
      where: { id: attemptId },
      data: {
        restartAuthorized: true,
        restartAuthorizedAt: new Date(),
        restartAuthorizedBy: req.user?.userId || null,
      },
      select: {
        id: true,
        quizId: true,
        userId: true,
        status: true,
        restartAuthorized: true,
        restartAuthorizedAt: true,
      },
    });

    res.set?.('Cache-Control', 'no-store');
    res.status(200).json({
      status: 'success',
      message: 'Restart authorized. Student can now start a fresh attempt.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// Fetch published quiz result for student
export const getQuizResult = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quizId = req.params.quizId as string;
    const userId = (req as any).user?.userId;
    if (!userId) throw new UnauthorizedError('Authentication required', 'UNAUTHORIZED');

    const quiz = await prisma.quiz.findUnique({ where: { id: quizId }, select: { id: true, answersPublished: true } });
    if (!quiz) throw new NotFoundError('Quiz not found', 'NOT_FOUND');
    if (!quiz.answersPublished) throw new ForbiddenError('Results are not published yet', 'FORBIDDEN');

    const attempt = await prisma.quizAttempt.findFirst({
      where: { quizId, userId, status: { in: ['SUBMITTED', 'EVALUATED'] } },
      include: {
        responses: true,
        quiz: {
          include: {
            questions: { orderBy: { createdAt: 'asc' } },
            questionUsages: { where: { isFinalized: true }, include: { question: true }, orderBy: { sortOrder: 'asc' } }
          }
        }
      }
    });

    if (!attempt) throw new NotFoundError('Attempt not found', 'NOT_FOUND');

    // Merge direct questions and finalized question-paper questions
    const directIds = new Set(attempt.quiz.questions.map((q: any) => q.id));
    const mergedQuestions = [
      ...attempt.quiz.questions,
      ...attempt.quiz.questionUsages
        .filter((usage: any) => !directIds.has(usage.questionId))
        .map((usage: any) => ({ ...usage.question, marks: usage.marks }))
    ];

    const normalizedResponses = attempt.responses.map((r: any) => {
      if (r.marksAwarded !== null && r.marksAwarded !== undefined) return r;
      const q = mergedQuestions.find((item: any) => item.id === r.questionId);
      if (q && OBJECTIVE_TYPES.includes(q.type) && q.answerKey !== null && q.answerKey !== undefined) {
        const answered = r.answerData !== null && r.answerData !== undefined && r.answerData !== '';
        const computedMarks = answered
          ? (isObjectiveAnswerCorrect(q, r.answerData) ? Number(q.marks || 0) : -Number(q.negativeMarks || 0))
          : 0;
        return { ...r, marksAwarded: computedMarks };
      }
      return r;
    });

    const resolvedQuestions = await resolveQuestionImages(mergedQuestions);
    const sanitizedQuiz = {
      ...attempt.quiz,
      questions: resolvedQuestions
    };
    delete (sanitizedQuiz as any).questionUsages;

    res.set?.('Cache-Control', 'no-store');
    res.status(200).json({
      status: 'success',
      data: {
        ...attempt,
        responses: normalizedResponses,
        quiz: sanitizedQuiz
      }
    });
  } catch (error) {
    next(error);
  }
};

// Verify 30-second live rotating OTP for quiz entrance
export const verifyQuizAccessOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quizId = req.params.quizId as string;
    const { otp } = req.body;

    if (!otp || typeof otp !== 'string') {
      throw new BadRequestError('6-digit OTP code is required.', 'INVALID_OTP');
    }

    const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
    if (!quiz) throw new NotFoundError('Quiz not found', 'NOT_FOUND');

    const isValid = verifyQuizOtp(quizId, otp);
    if (!isValid) {
      throw new BadRequestError('Invalid or expired OTP. Please use the current live OTP from your instructor.', 'OTP_VERIFICATION_FAILED');
    }

    res.status(200).json({
      status: 'success',
      message: 'OTP verified successfully.',
      data: { verified: true, quizId }
    });
  } catch (error) {
    next(error);
  }
};

