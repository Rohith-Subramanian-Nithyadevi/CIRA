import { Request, Response, NextFunction } from 'express';
import { PrismaClient, ResponseStatus, QuestionType } from '@prisma/client';
import { BadRequestError } from '../utils/errors';

const prisma = new PrismaClient();

// Get eligible quizzes for the logged-in student
export const getEligibleQuizzes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
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
          {
            OR: [
              { targetDepartments: { some: { departmentId: user.departmentId || '' } } },
              { targetSections: { some: { sectionId: user.sectionId || '' } } },
              { targetStudents: { some: { userId: user.id } } }
            ]
          },
          {
            OR: [
              { startDate: null },
              { startDate: { lte: now } }
            ]
          },
          {
            OR: [
              { endDate: null },
              { endDate: { gte: now } }
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

    res.status(200).json({ status: 'success', data: quizzes });
  } catch (error) {
    next(error);
  }
};

// Start or Resume Exam
export const startExam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quizId = req.params.quizId as string;
    const userId = (req as any).user?.id;

    // Check if attempt exists
    let attempt = await prisma.quizAttempt.findFirst({
      where: { quizId, userId },
      include: {
        responses: true
      }
    });

    if (!attempt) {
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

    if (attempt.status !== 'IN_PROGRESS') {
      throw new BadRequestError('Exam already submitted', 'FORBIDDEN');
    }

    // Fetch quiz questions (without answers if we want to be secure, but we'll fetch full for simplicity in this MVP)
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          select: { id: true, type: true, text: true, marks: true, negativeMarks: true, options: true, quizId: true } // Exclude answerKey
        }
      }
    });

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
    
    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        responses: true,
        quiz: { include: { questions: true } }
      }
    });

    if (!attempt) throw new BadRequestError('Attempt not found', 'NOT_FOUND');
    if (attempt.status !== 'IN_PROGRESS') throw new BadRequestError('Exam already submitted', 'FORBIDDEN');

    let objectiveScore = 0;

    // Auto Evaluate
    for (const response of attempt.responses) {
      if (response.status === 'ANSWERED' || response.status === 'ANSWERED_AND_MARKED_FOR_REVIEW') {
        const question = attempt.quiz.questions.find((q: any) => q.id === response.questionId);
        if (question) {
          // Objective evaluation logic based on type
          const isObjective = ['MCQ', 'MULTI_SELECT', 'TRUE_FALSE', 'MATCHING', 'NUMERICAL', 'FILL_BLANK'].includes(question.type);
          
          if (isObjective && question.answerKey) {
            // Simplified check: stringify comparison (Works for basic objects/arrays if sorted, but we assume exact match for MVP)
            const isCorrect = JSON.stringify(response.answerData) === JSON.stringify(question.answerKey);
            if (isCorrect) {
              objectiveScore += question.marks;
            } else {
              objectiveScore -= question.negativeMarks;
            }
          }
        }
      }
    }

    const updated = await prisma.quizAttempt.update({
      where: { id: attemptId },
      data: {
        status: 'SUBMITTED',
        endTime: new Date(),
        objectiveScore,
        totalScore: objectiveScore // Written score is 0 until graded
      }
    });

    res.status(200).json({ status: 'success', data: updated });
  } catch (error) {
    next(error);
  }
};
