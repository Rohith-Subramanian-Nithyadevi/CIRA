import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { BadRequestError, ForbiddenError, NotFoundError, UnauthorizedError } from '../utils/errors';
import { assertStudentOwnsAttempt } from '../utils/faculty-security';

const OBJECTIVE_TYPES = ['MCQ', 'MULTI_SELECT', 'TRUE_FALSE', 'MATCHING', 'NUMERICAL', 'FILL_BLANK'];

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
          where: { userId: user.id }
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
              startTime: attempt.startTime,
              endTime: attempt.endTime
            }
      )
    }));

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
      select: { id: true, status: true, startTime: true }
    });

    if (attempt) {
      if (attempt.status !== 'IN_PROGRESS') {
        throw new BadRequestError('You have already submitted this quiz.', 'ALREADY_SUBMITTED');
      }
      const ageInSeconds = (Date.now() - new Date(attempt.startTime).getTime()) / 1000;
      if (ageInSeconds > 60) {
        await prisma.quizAttempt.update({
          where: { id: attempt.id },
          data: { status: 'SUBMITTED', endTime: new Date() }
        });
        throw new BadRequestError(
          'You left the secure exam environment. Your exam has been automatically submitted and cannot be resumed.',
          'FORBIDDEN'
        );
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
          startDate: quiz.startDate,
          endDate: quiz.endDate,
          questionCount: questionIds.size
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

    // Check if attempt exists
    let attempt = await prisma.quizAttempt.findFirst({
      where: { quizId, userId },
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
    
    if (!attempt) {
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

    if (attempt) {
      if (attempt.status !== 'IN_PROGRESS') {
        throw new BadRequestError('Exam already submitted', 'FORBIDDEN');
      }

      // Prevent resuming: if the attempt was created more than 60 seconds ago,
      // it means they left the portal and are trying to resume.
      // We block this and auto-submit the exam to enforce the strict "no re-entry" rule.
      const ageInSeconds = (new Date().getTime() - new Date(attempt.startTime).getTime()) / 1000;
      if (ageInSeconds > 60) {
        await prisma.quizAttempt.update({
          where: { id: attempt.id },
          data: { status: 'SUBMITTED', endTime: new Date() }
        });
        throw new BadRequestError('You left the secure exam environment. Your exam has been automatically submitted and cannot be resumed.', 'FORBIDDEN');
      }
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
      quiz.questions = quiz.questions.map((q: any) => {
        if (q.type === 'MATCHING' && Array.isArray(q.options)) {
          const lefts = q.options.map((o: any) => o.left);
          const rights = q.options.map((o: any) => o.right).sort(() => Math.random() - 0.5);
          q.options = { lefts, rights };
        }
        return q;
      });
    }

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
    if (!attempt || attempt.status !== 'IN_PROGRESS') {
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

    res.status(200).json({ status: 'success', data: response });
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
    if (attempt.status !== 'IN_PROGRESS') throw new BadRequestError('Exam already submitted', 'FORBIDDEN');

    assertStudentOwnsAttempt((req as any).user, attempt);

    const usedQuestionIds = new Set(attempt.quiz.questions.map((question: any) => question.id));
    const gradingQuestions = [...attempt.quiz.questions, ...attempt.quiz.questionUsages.filter((usage: any) => !usedQuestionIds.has(usage.questionId)).map((usage: any) => ({ ...usage.question, marks: usage.marks }))];
    let objectiveScore = 0;

    // Auto Evaluate
    const responseUpdates: { id: string; marksAwarded: number }[] = [];
    for (const response of attempt.responses) {
      if (response.status === 'ANSWERED' || response.status === 'ANSWERED_AND_MARKED_FOR_REVIEW') {
        const question = gradingQuestions.find((q: any) => q.id === response.questionId);
        if (question) {
          const isObjective = OBJECTIVE_TYPES.includes(question.type);
          if (isObjective && question.answerKey !== null && question.answerKey !== undefined) {
            const isCorrect = isObjectiveAnswerCorrect(question, response.answerData);
            const awarded = isCorrect ? Number(question.marks || 0) : -Number(question.negativeMarks || 0);
            objectiveScore += awarded;
            responseUpdates.push({ id: response.id, marksAwarded: awarded });
          }
        }
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      for (const upd of responseUpdates) {
        await tx.quizResponse.update({
          where: { id: upd.id },
          data: { marksAwarded: upd.marksAwarded }
        });
      }

      return tx.quizAttempt.update({
        where: { id: attemptId },
        data: {
          status: 'SUBMITTED',
          endTime: new Date(),
          objectiveScore,
          totalScore: objectiveScore, // Written score is 0 until graded
          violationReason: violationReason || null
        }
      });
    });

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

// Faculty: Allow a student to restart an exam (deletes their attempt)
export const allowRestart = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attemptId = req.params.attemptId as string;

    const attempt = await prisma.quizAttempt.findUnique({ 
      where: { id: attemptId },
      include: { quiz: true }
    });
    if (!attempt) throw new BadRequestError('Attempt not found', 'NOT_FOUND');

    // Authorization check: only ADMIN or the quiz creator can delete an attempt
    if (req.user?.role !== 'ADMIN' && attempt.quiz.createdBy !== req.user?.userId) {
      throw new UnauthorizedError('Not authorized to modify attempts for this quiz', 'UNAUTHORIZED');
    }

    // Delete the attempt and all its responses (cascade)
    await prisma.quizAttempt.delete({ where: { id: attemptId } });

    res.status(200).json({ status: 'success', message: 'Student can now retake the exam.' });
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

    const sanitizedQuiz = {
      ...attempt.quiz,
      questions: mergedQuestions
    };
    delete (sanitizedQuiz as any).questionUsages;

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
