import { Request, Response, NextFunction } from 'express';
import { PrismaClient, QuestionType } from '@prisma/client';
import { BadRequestError } from '../utils/errors';

const prisma = new PrismaClient();

// Create Quiz (Basic Info & Schedule)
export const createQuiz = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      title,
      subject,
      description,
      instructions,
      totalMarks,
      passingMarks,
      startDate,
      endDate,
      durationMinutes,
      allowLateJoin,
      autoSubmit,
      performanceBands,
      targetDepartments, // array of department IDs
      targetSections,    // array of section IDs
      targetStudents     // array of user IDs
    } = req.body;

    // We assume the auth middleware sets req.user
    const createdBy = (req as any).user?.id || 'system';

    const quiz = await prisma.quiz.create({
      data: {
        title,
        subject,
        description,
        instructions,
        totalMarks: Number(totalMarks) || 0,
        passingMarks: Number(passingMarks) || 0,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        durationMinutes: Number(durationMinutes) || 60,
        allowLateJoin: Boolean(allowLateJoin),
        autoSubmit: Boolean(autoSubmit),
        performanceBands,
        createdBy,
        targetDepartments: targetDepartments?.length ? {
          create: targetDepartments.map((depId: string) => ({ departmentId: depId }))
        } : undefined,
        targetSections: targetSections?.length ? {
          create: targetSections.map((secId: string) => ({ sectionId: secId }))
        } : undefined,
        targetStudents: targetStudents?.length ? {
          create: targetStudents.map((userId: string) => ({ userId: userId }))
        } : undefined
      }
    });

    res.status(201).json({ status: 'success', data: quiz });
  } catch (error) {
    next(error);
  }
};

// Add/Edit Questions
export const addQuestions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quizId = req.params.quizId as string;
    const { questions } = req.body; // Array of questions

    if (!Array.isArray(questions)) {
      throw new BadRequestError('Questions must be an array', 'INVALID_INPUT');
    }

    // Insert all questions (For simplicity, we delete existing and recreate, or just create new ones)
    // A robust version would upsert based on question IDs. Here we just create.
    const createdQuestions = await prisma.$transaction(
      questions.map((q: any) =>
        prisma.question.create({
          data: {
            quizId,
            type: q.type as QuestionType,
            text: q.text,
            marks: Number(q.marks) || 1,
            negativeMarks: Number(q.negativeMarks) || 0,
            options: q.options || null,
            answerKey: q.answerKey || null,
            explanation: q.explanation || null,
          }
        })
      )
    );

    res.status(201).json({ status: 'success', data: createdQuestions });
  } catch (error) {
    next(error);
  }
};

// Get Submissions for Grading
export const getSubmissions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quizId = req.params.quizId as string;
    
    const attempts = await prisma.quizAttempt.findMany({
      where: { quizId, status: 'SUBMITTED' },
      include: {
        user: { select: { name: true, rollNumber: true, email: true } },
        responses: { include: { question: true } }
      }
    });

    res.status(200).json({ status: 'success', data: attempts });
  } catch (error) {
    next(error);
  }
};

// Evaluate written questions
export const evaluateAttempt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attemptId = req.params.attemptId as string;
    const { writtenScore, facultyFeedback, performanceCategory, finalGrade } = req.body;

    const attempt = await prisma.quizAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt) throw new BadRequestError('Attempt not found', 'NOT_FOUND');

    const totalScore = attempt.objectiveScore + (Number(writtenScore) || 0);

    const updated = await prisma.quizAttempt.update({
      where: { id: attemptId },
      data: {
        writtenScore: Number(writtenScore),
        totalScore,
        facultyFeedback,
        performanceCategory: performanceCategory || null,
        finalGrade: finalGrade || null,
        status: 'EVALUATED'
      }
    });

    res.status(200).json({ status: 'success', data: updated });
  } catch (error) {
    next(error);
  }
};
