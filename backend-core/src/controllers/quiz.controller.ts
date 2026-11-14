import { Request, Response, NextFunction } from 'express';
import { QuestionType } from '@prisma/client';
import { prisma } from '../config/prisma';
import { BadRequestError, ForbiddenError, NotFoundError, UnauthorizedError } from '../utils/errors';
import { normalizeStoredImageValue, resolveQuestionImages, uploadToObjectStorage, uploadBufferToObjectStorage } from '../utils/object-storage';
import { generateQuizOtp, getOtpRemainingSeconds } from '../utils/totp';
import { OBJECTIVE_TYPES, gradeObjectiveResponse } from './student-exam.controller';

const stableJsonEqual = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// Get All Quizzes for logged in Faculty
export const getQuizzes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId || 'system';
    const userRole = (req as any).user?.role;

    // Faculty sees only their quizzes, Admins see all.
    const whereClause: any = userRole === 'ADMIN' ? {} : { createdBy: userId };
    const filters: any[] = [];
    if (req.query.posted === 'true') {
      filters.push({ OR: [
        { targetDepartments: { some: {} } },
        { targetSections: { some: {} } },
        { targetStudents: { some: {} } }
      ] });
    }

    const departmentId = req.query.departmentId as string | undefined;
    const sectionId = req.query.sectionId as string | undefined;
    if (sectionId) {
      filters.push({ OR: [
        { targetSections: { some: { sectionId } } },
        ...(departmentId ? [{ targetDepartments: { some: { departmentId } } }] : [])
      ] });
    } else if (departmentId) {
      filters.push({ targetDepartments: { some: { departmentId } } });
    }
    if (filters.length > 0) {
      whereClause.AND = filters;
    }

    const hasPagination = req.query.page !== undefined || req.query.limit !== undefined;

    const includeOptions = {
      _count: {
        select: { questions: true, attempts: true }
      },
      targetDepartments: { include: { department: { select: { id: true, name: true } } } },
      targetSections: { include: { section: { select: { id: true, name: true } } } },
      targetStudents: { select: { userId: true } }
    };

    if (hasPagination) {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const [total, quizzes] = await prisma.$transaction([
        prisma.quiz.count({ where: whereClause }),
        prisma.quiz.findMany({
          where: whereClause,
          include: includeOptions,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        })
      ]);

      const hasMore = skip + quizzes.length < total;
      res.status(200).json({ status: 'success', data: { items: quizzes, total, page, hasMore } });
    } else {
      const quizzes = await prisma.quiz.findMany({
        where: whereClause,
        include: includeOptions,
        orderBy: { createdAt: 'desc' }
      });

      res.status(200).json({ status: 'success', data: quizzes });
    }
  } catch (error) {
    next(error);
  }
};

// Get a Single Quiz by ID
export const getQuizById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quizId = req.params.quizId as string;
    const userId = (req as any).user?.userId || 'system';
    const userRole = (req as any).user?.role;

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: { orderBy: { createdAt: 'asc' } },
        targetDepartments: { include: { department: { select: { id: true, name: true } } } },
        targetSections: { include: { section: { select: { id: true, name: true } } } }
      }
    });

    if (!quiz) {
      throw new BadRequestError('Quiz not found', 'NOT_FOUND');
    }

    if (userRole !== 'ADMIN' && quiz.createdBy !== userId) {
      throw new BadRequestError('Not authorized to access this quiz', 'UNAUTHORIZED');
    }

    if (Array.isArray((quiz as any).questions)) {
      (quiz as any).questions = await resolveQuestionImages((quiz as any).questions);
    }

    res.status(200).json({ status: 'success', data: quiz });
  } catch (error) {
    next(error);
  }
};

// Delete a Quiz
export const deleteQuiz = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quizId = req.params.quizId as string;
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;

    if (!userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId }
    });

    if (!quiz) {
      throw new NotFoundError('Quiz not found', 'NOT_FOUND');
    }

    if (userRole !== 'ADMIN' && quiz.createdBy !== userId) {
      throw new ForbiddenError('Not authorized to delete this quiz', 'UNAUTHORIZED');
    }

    await prisma.quiz.delete({
      where: { id: quizId }
    });

    res.status(200).json({ status: 'success', message: 'Quiz deleted successfully' });
  } catch (error) {
    next(error);
  }
};

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
    const createdBy = (req as any).user?.userId || 'system';

    // Retrieve faculty subject from user profile as the source of truth if available
    let resolvedSubject = subject;
    if (createdBy && createdBy !== 'system') {
      const faculty = await prisma.user.findUnique({
        where: { id: createdBy },
        select: { subject: true }
      });
      if (faculty?.subject) {
        resolvedSubject = faculty.subject;
      }
    }

    const quiz = await prisma.quiz.create({
      data: {
        title,
        subject: resolvedSubject,
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

// Update quiz metadata, targets, and optionally questions (when no attempts exist yet).
export const updateQuiz = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quizId = req.params.quizId as string;
    const userId = (req as any).user?.userId || 'system';
    const userRole = (req as any).user?.role;
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
      targetDepartments = [],
      targetSections = [],
      targetStudents = [],
      questions
    } = req.body;

    const existing = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: { questions: { orderBy: { createdAt: 'asc' } } }
    });
    if (!existing) throw new NotFoundError('Quiz not found', 'NOT_FOUND');
    if (userRole !== 'ADMIN' && existing.createdBy !== userId) {
      throw new ForbiddenError('Not authorized to edit this quiz', 'FORBIDDEN');
    }

    let resolvedSubject = subject ?? existing.subject;
    if (existing.createdBy && existing.createdBy !== 'system') {
      const faculty = await prisma.user.findUnique({
        where: { id: existing.createdBy },
        select: { subject: true }
      });
      if (faculty?.subject) {
        resolvedSubject = faculty.subject;
      }
    }

    let regradedCount = 0;
    const updated = await prisma.$transaction(async (tx) => {
      const attemptCount = Array.isArray(questions)
        ? await tx.quizAttempt.count({ where: { quizId } })
        : 0;

      const quiz = await tx.quiz.update({
        where: { id: quizId },
        data: {
          title,
          subject: resolvedSubject,
          description,
          instructions,
          totalMarks: Number(totalMarks) || 0,
          passingMarks: Number(passingMarks) || 0,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          durationMinutes: Number(durationMinutes) || 60,
          allowLateJoin: Boolean(allowLateJoin),
          autoSubmit,
          performanceBands
        }
      });

      await tx.quizDepartment.deleteMany({ where: { quizId } });
      await tx.quizSection.deleteMany({ where: { quizId } });
      await tx.quizStudent.deleteMany({ where: { quizId } });

      if (Array.isArray(targetDepartments) && targetDepartments.length) {
        await tx.quizDepartment.createMany({ data: targetDepartments.map((departmentId: string) => ({ quizId, departmentId })) });
      }
      if (Array.isArray(targetSections) && targetSections.length) {
        await tx.quizSection.createMany({ data: targetSections.map((sectionId: string) => ({ quizId, sectionId })) });
      }
      if (Array.isArray(targetStudents) && targetStudents.length) {
        await tx.quizStudent.createMany({ data: targetStudents.map((studentId: string) => ({ quizId, userId: studentId })) });
      }

      if (Array.isArray(questions)) {
        if (attemptCount === 0) {
          await tx.questionUsage.deleteMany({ where: { quizId, question: { quizId } } });
          await tx.question.deleteMany({ where: { quizId } });

          for (let sortOrder = 0; sortOrder < questions.length; sortOrder++) {
            const q = questions[sortOrder];
            await tx.question.create({
              data: {
                quizId,
                ownerId: existing.createdBy,
                category: 'TEST_QUIZ',
                subject: q.subject ?? resolvedSubject,
                type: q.type as QuestionType,
                text: q.text,
                topic: q.topic ?? null,
                subtopic: q.subtopic ?? null,
                difficulty: q.difficulty ?? null,
                tags: Array.isArray(q.tags) ? q.tags : [],
                marks: Number(q.marks) || 1,
                negativeMarks: Number(q.negativeMarks) || 0,
                options: q.options ?? undefined,
                answerKey: q.answerKey ?? undefined,
                explanation: q.explanation ?? undefined,
                image: normalizeStoredImageValue(q.image) ?? undefined,
                usages: {
                  create: {
                    category: 'TEST_QUIZ',
                    quizId,
                    assessmentTitle: quiz.title,
                    marks: Number(q.marks) || 1,
                    sortOrder
                  }
                }
              }
            });
          }
        } else {
          // Attempts exist: update questions in-place to preserve response FKs and regrade objective questions safely
          const existingById = new Map<string, any>(
            (existing.questions || []).map((eq: any) => [eq.id, eq])
          );
          const retainedIds = new Set<string>();
          const changedObjectiveQuestionIds = new Set<string>();
          const modifiedManualQuestionIds = new Set<string>();
          const removedQuestionIds = new Set<string>();

          for (let sortOrder = 0; sortOrder < questions.length; sortOrder++) {
            const q = questions[sortOrder];
            const matchedExisting = q.id ? existingById.get(q.id) : null;
            if (matchedExisting) {
              retainedIds.add(matchedExisting.id);
              const nextMarks = Number(q.marks) || 1;
              const nextNegMarks = Number(q.negativeMarks) || 0;
              const nextOptions = q.options ?? undefined;
              const nextAnswerKey = q.answerKey ?? undefined;

              const answerKeyChanged = !stableJsonEqual(matchedExisting.answerKey, nextAnswerKey);
              const optionsChanged =
                matchedExisting.type === 'MATCHING' &&
                !stableJsonEqual(matchedExisting.options, nextOptions);
              const marksChanged =
                Number(matchedExisting.marks) !== nextMarks ||
                Number(matchedExisting.negativeMarks ?? 0) !== nextNegMarks;
              const textChanged = String(matchedExisting.text || '') !== String(q.text || '');

              await tx.question.update({
                where: { id: matchedExisting.id },
                data: {
                  subject: q.subject ?? resolvedSubject,
                  type: (q.type || matchedExisting.type) as QuestionType,
                  text: q.text,
                  topic: q.topic ?? null,
                  subtopic: q.subtopic ?? null,
                  difficulty: q.difficulty ?? null,
                  tags: Array.isArray(q.tags) ? q.tags : matchedExisting.tags,
                  marks: nextMarks,
                  negativeMarks: nextNegMarks,
                  options: nextOptions,
                  answerKey: nextAnswerKey,
                  explanation: q.explanation ?? undefined,
                  image: normalizeStoredImageValue(q.image) ?? undefined,
                }
              });

              if (answerKeyChanged || optionsChanged || marksChanged || textChanged) {
                if (answerKeyChanged || optionsChanged || marksChanged) {
                  await tx.quizEvaluationAudit.create({
                    data: {
                      quizId,
                      questionId: matchedExisting.id,
                      facultyId: userId,
                      action: 'ANSWER_KEY_UPDATE',
                      previousValue: {
                        answerKey: matchedExisting.answerKey,
                        marks: matchedExisting.marks,
                        negativeMarks: matchedExisting.negativeMarks ?? 0,
                      },
                      updatedValue: {
                        answerKey: nextAnswerKey ?? null,
                        marks: nextMarks,
                        negativeMarks: nextNegMarks,
                      },
                      note: existing.answersPublished
                        ? 'Updated after answer publication'
                        : 'Updated with existing attempts',
                    },
                  });
                }

                if (OBJECTIVE_TYPES.includes(matchedExisting.type)) {
                  if (answerKeyChanged || optionsChanged || marksChanged) {
                    changedObjectiveQuestionIds.add(matchedExisting.id);
                  }
                } else {
                  modifiedManualQuestionIds.add(matchedExisting.id);
                }
              }
            } else {
              await tx.question.create({
                data: {
                  quizId,
                  ownerId: existing.createdBy,
                  category: 'TEST_QUIZ',
                  subject: q.subject ?? resolvedSubject,
                  type: q.type as QuestionType,
                  text: q.text,
                  topic: q.topic ?? null,
                  subtopic: q.subtopic ?? null,
                  difficulty: q.difficulty ?? null,
                  tags: Array.isArray(q.tags) ? q.tags : [],
                  marks: Number(q.marks) || 1,
                  negativeMarks: Number(q.negativeMarks) || 0,
                  options: q.options ?? undefined,
                  answerKey: q.answerKey ?? undefined,
                  explanation: q.explanation ?? undefined,
                  image: normalizeStoredImageValue(q.image) ?? undefined,
                  usages: {
                    create: {
                      category: 'TEST_QUIZ',
                      quizId,
                      assessmentTitle: quiz.title,
                      marks: Number(q.marks) || 1,
                      sortOrder
                    }
                  }
                }
              });
            }
          }

          for (const eq of existing.questions || []) {
            if (!retainedIds.has(eq.id)) {
              removedQuestionIds.add(eq.id);
              const respCount = await tx.quizResponse.count({ where: { questionId: eq.id } });
              if (respCount === 0) {
                await tx.questionUsage.deleteMany({ where: { quizId, questionId: eq.id } });
                await tx.question.delete({ where: { id: eq.id } });
              } else {
                await tx.question.update({ where: { id: eq.id }, data: { quizId: null } });
              }
            }
          }

          if (
            changedObjectiveQuestionIds.size > 0 ||
            modifiedManualQuestionIds.size > 0 ||
            removedQuestionIds.size > 0
          ) {
            const latestQuestions = await tx.question.findMany({ where: { quizId } });
            const latestById = new Map<string, any>(latestQuestions.map((lq: any) => [lq.id, lq]));

            const attemptsToCheck = await tx.quizAttempt.findMany({
              where: {
                quizId,
                isManualWithoutSubmission: false,
                status: { in: ['SUBMITTED', 'EVALUATED'] },
              },
              include: {
                responses: {
                  include: { question: true },
                },
              },
            });

            for (const att of attemptsToCheck) {
              let newObjectiveScore = 0;
              let newWrittenScore = 0;
              let attemptNeedsReview = Boolean(att.needsReview);
              const hasManualResponses = (att.responses || []).some(
                (r: any) => r.question && !OBJECTIVE_TYPES.includes(r.question.type) && !removedQuestionIds.has(r.questionId)
              );

              for (const resp of att.responses || []) {
                if (removedQuestionIds.has(resp.questionId)) {
                  continue;
                }
                const currentQ = latestById.get(resp.questionId) || resp.question;
                if (!currentQ) continue;

                if (OBJECTIVE_TYPES.includes(currentQ.type)) {
                  let awarded = Number(resp.marksAwarded ?? 0);
                  if (changedObjectiveQuestionIds.has(currentQ.id)) {
                    const recomputed = gradeObjectiveResponse(currentQ, resp);
                    if (recomputed !== null) {
                      awarded = recomputed;
                      if (Number(resp.marksAwarded ?? 0) !== awarded) {
                        await tx.quizResponse.update({
                          where: { id: resp.id },
                          data: { marksAwarded: awarded },
                        });
                      }
                    }
                  }
                  newObjectiveScore += awarded;
                } else {
                  // Preserve manually awarded marks; flag for faculty review if the manual question changed
                  if (modifiedManualQuestionIds.has(currentQ.id)) {
                    attemptNeedsReview = true;
                  }
                  newWrittenScore += Number(resp.marksAwarded ?? 0);
                }
              }

              if (!hasManualResponses && Number(att.writtenScore ?? 0) > 0 && modifiedManualQuestionIds.size === 0) {
                newWrittenScore = Number(att.writtenScore ?? 0);
              }

              const newTotalScore = newObjectiveScore + newWrittenScore;
              const scoreChanged =
                Math.abs(newObjectiveScore - Number(att.objectiveScore ?? 0)) > 1e-6 ||
                Math.abs(newWrittenScore - Number(att.writtenScore ?? 0)) > 1e-6 ||
                Math.abs(newTotalScore - Number(att.totalScore ?? 0)) > 1e-6;

              if (scoreChanged || attemptNeedsReview !== Boolean(att.needsReview)) {
                await tx.quizAttempt.update({
                  where: { id: att.id },
                  data: {
                    objectiveScore: newObjectiveScore,
                    writtenScore: newWrittenScore,
                    totalScore: newTotalScore,
                    needsReview: attemptNeedsReview,
                    ...(scoreChanged && existing.answersPublished ? { resultUpdatedAt: new Date() } : {}),
                  },
                });

                if (scoreChanged) {
                  regradedCount++;
                  await tx.quizEvaluationAudit.create({
                    data: {
                      quizId,
                      attemptId: att.id,
                      studentId: att.userId,
                      facultyId: userId,
                      action: 'AUTO_REGRADE',
                      previousValue: {
                        objectiveScore: att.objectiveScore,
                        writtenScore: att.writtenScore,
                        totalScore: att.totalScore,
                      },
                      updatedValue: {
                        objectiveScore: newObjectiveScore,
                        writtenScore: newWrittenScore,
                        totalScore: newTotalScore,
                      },
                      note: 'Automatic regrade after answer key update',
                    },
                  });

                  if (existing.answersPublished) {
                    await tx.studentNotification.create({
                      data: {
                        userId: att.userId,
                        type: 'ASSESSMENT',
                        title: `Quiz Result Updated: ${quiz.title}`,
                        message: `An answer key in "${quiz.title}" was updated by faculty. Your updated score is ${newTotalScore} (Auto: ${newObjectiveScore}, Written: ${newWrittenScore}).`,
                      },
                    });
                  }
                }
              }
            }
          }
        }
      }

      return quiz;
    });

    res.status(200).json({ status: 'success', data: updated, regradedCount });
  } catch (error) {
    next(error);
  }
};

// Add/Edit Questions
export const addQuestions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quizId = req.params.quizId as string;
    const { questions } = req.body; // Array of questions
    const actor = (req as any).user;
    const quiz = await prisma.quiz.findUnique({ where: { id: quizId }, select: { id: true, title: true, subject: true, createdBy: true } });
    if (!quiz) throw new BadRequestError('Quiz not found', 'NOT_FOUND');
    if (actor?.role !== 'ADMIN' && quiz.createdBy !== actor?.userId) throw new UnauthorizedError('Not authorized to manage questions for this quiz', 'UNAUTHORIZED');

    if (!Array.isArray(questions)) {
      throw new BadRequestError('Questions must be an array', 'INVALID_INPUT');
    }

    // Insert all questions (For simplicity, we delete existing and recreate, or just create new ones)
    // A robust version would upsert based on question IDs. Here we just create.
    const createdQuestions = await prisma.$transaction(
      questions.map((q: any, sortOrder: number) =>
        prisma.question.create({
          data: {
            quizId,
            ownerId: quiz.createdBy,
            category: 'TEST_QUIZ',
            subject: q.subject ?? quiz.subject,
            type: q.type as QuestionType,
            text: q.text,
            topic: q.topic ?? null,
            subtopic: q.subtopic ?? null,
            difficulty: q.difficulty ?? null,
            tags: Array.isArray(q.tags) ? q.tags : [],
            marks: Number(q.marks) || 1,
            negativeMarks: Number(q.negativeMarks) || 0,
            options: q.options ?? undefined,
            answerKey: q.answerKey ?? undefined,
            explanation: q.explanation ?? undefined,
            image: normalizeStoredImageValue(q.image) ?? undefined,
            usages: { create: { category: 'TEST_QUIZ', quizId, assessmentTitle: quiz.title, marks: Number(q.marks) || 1, sortOrder } },
          }
        })
      )
    );

    const resolvedQuestions = await resolveQuestionImages(createdQuestions);
    res.status(201).json({ status: 'success', data: resolvedQuestions });
  } catch (error) {
    next(error);
  }
};

// Helper to build a consistent class identifier and human-readable label for a student/target
const buildClassMeta = (
  department?: { id?: string; name?: string; batch?: { id?: string; name?: string } | null } | null,
  section?: { id?: string; name?: string; departmentId?: string; department?: { id?: string; name?: string; batch?: { id?: string; name?: string } | null } | null } | null
) => {
  const resolvedDept = department || section?.department || null;
  const batchName = resolvedDept?.batch?.name || '';
  const departmentId = resolvedDept?.id || section?.departmentId || null;
  const departmentName = resolvedDept?.name || '';
  const sectionId = section?.id || null;
  const sectionName = section?.name || '';

  if (!departmentId && !sectionId) {
    return {
      classKey: 'unassigned',
      classLabel: 'Unassigned Class',
      shortLabel: 'Unassigned',
      batchName: '',
      departmentId: null,
      departmentName: '',
      sectionId: null,
      sectionName: '',
    };
  }

  const classKey = sectionId ? `section:${sectionId}` : `dept:${departmentId}`;
  const shortLabel = sectionName
    ? `${departmentName || 'Department'} – ${sectionName}`
    : departmentName || 'Department';
  const classLabel = batchName ? `${batchName} · ${shortLabel}` : shortLabel;

  return {
    classKey,
    classLabel,
    shortLabel,
    batchName,
    departmentId,
    departmentName,
    sectionId,
    sectionName,
  };
};

// Get Submissions for View Submissions / Grading (complete assigned class roster + attempts)
export const getSubmissions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quizId = req.params.quizId as string;
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: {
        id: true,
        title: true,
        subject: true,
        totalMarks: true,
        answersPublished: true,
        createdBy: true,
        questions: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            type: true,
            text: true,
            marks: true,
            options: true,
            answerKey: true,
            explanation: true,
            image: true,
          }
        },
        targetDepartments: {
          select: {
            departmentId: true,
            department: {
              select: {
                id: true,
                name: true,
                batch: { select: { id: true, name: true } }
              }
            }
          }
        },
        targetSections: {
          select: {
            sectionId: true,
            section: {
              select: {
                id: true,
                name: true,
                departmentId: true,
                department: {
                  select: {
                    id: true,
                    name: true,
                    batch: { select: { id: true, name: true } }
                  }
                }
              }
            }
          }
        },
        targetStudents: {
          select: { userId: true }
        }
      }
    });
    if (!quiz) throw new NotFoundError('Quiz not found', 'NOT_FOUND');
    if (userRole !== 'ADMIN' && quiz.createdBy !== userId) {
      throw new ForbiddenError('Not authorized to view submissions for this quiz', 'FORBIDDEN');
    }

    const targetDepartments = quiz.targetDepartments || [];
    const targetSections = quiz.targetSections || [];
    const targetStudents = quiz.targetStudents || [];

    // When specific sections are assigned within a department, scope to those sections rather than the whole department
    const departmentsWithSpecificSections = new Set(
      targetSections.map((ts: any) => ts.section?.departmentId || ts.section?.department?.id).filter(Boolean)
    );
    const wholeDepartmentTargets = targetDepartments.filter(
      (td: any) => !departmentsWithSpecificSections.has(td.departmentId)
    );

    const targetSectionIds = targetSections.map((ts: any) => ts.sectionId).filter(Boolean);
    const wholeDepartmentIds = wholeDepartmentTargets.map((td: any) => td.departmentId).filter(Boolean);
    const targetStudentIds = targetStudents.map((ts: any) => ts.userId).filter(Boolean);

    const audienceOrFilters: any[] = [];
    if (targetSectionIds.length > 0) audienceOrFilters.push({ sectionId: { in: targetSectionIds } });
    if (wholeDepartmentIds.length > 0) audienceOrFilters.push({ departmentId: { in: wholeDepartmentIds } });
    if (targetStudentIds.length > 0) audienceOrFilters.push({ id: { in: targetStudentIds } });

    const [attempts, eligibleStudents] = await Promise.all([
      prisma.quizAttempt.findMany({
        where: { quizId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              rollNumber: true,
              email: true,
              departmentId: true,
              sectionId: true,
              department: { select: { id: true, name: true, batch: { select: { id: true, name: true } } } },
              section: { select: { id: true, name: true } }
            }
          },
          responses: { include: { question: true } },
          violations: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              type: true,
              reason: true,
              metadata: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' }
      }),
      audienceOrFilters.length > 0
        ? prisma.user.findMany({
            where: {
              role: 'STUDENT',
              approvalStatus: { not: 'REJECTED' },
              OR: audienceOrFilters
            },
            select: {
              id: true,
              name: true,
              rollNumber: true,
              email: true,
              departmentId: true,
              sectionId: true,
              department: { select: { id: true, name: true, batch: { select: { id: true, name: true } } } },
              section: { select: { id: true, name: true } }
            },
            orderBy: [{ rollNumber: 'asc' }, { name: 'asc' }]
          })
        : Promise.resolve([])
    ]);

    // Map latest attempt per student (deduplicated by userId)
    const attemptByUserId = new Map<string, any>();
    for (const attempt of attempts as any[]) {
      const attemptUserId = attempt.userId || attempt.user?.id || attempt.student?.id;
      if (attemptUserId && !attemptByUserId.has(attemptUserId)) {
        attemptByUserId.set(attemptUserId, attempt);
      }
    }

    // Collect assigned class metadata in deterministic order
    const classMap = new Map<string, ReturnType<typeof buildClassMeta>>();
    for (const ts of targetSections as any[]) {
      const meta = buildClassMeta(ts.section?.department, ts.section);
      if (!classMap.has(meta.classKey)) classMap.set(meta.classKey, meta);
    }
    for (const td of wholeDepartmentTargets as any[]) {
      const meta = buildClassMeta(td.department, null);
      if (!classMap.has(meta.classKey)) classMap.set(meta.classKey, meta);
    }

    // Merge eligible roster students with any existing attempt students (no duplicate students)
    const seenUserIds = new Set<string>();
    const roster: any[] = [];

    const pushRosterRow = (student: any, attempt: any | null) => {
      const studentId = student?.id;
      if (!studentId || seenUserIds.has(studentId)) return;
      seenUserIds.add(studentId);

      // Prefer section-level class key when quiz targets that section or whole department
      const meta = buildClassMeta(student.department, student.section);
      const effectiveClassKey =
        meta.sectionId && classMap.has(`section:${meta.sectionId}`)
          ? `section:${meta.sectionId}`
          : meta.departmentId && classMap.has(`dept:${meta.departmentId}`)
          ? `dept:${meta.departmentId}`
          : meta.classKey;

      const resolvedClassMeta = classMap.get(effectiveClassKey) || meta;
      if (!classMap.has(resolvedClassMeta.classKey) && (student.departmentId || student.sectionId)) {
        classMap.set(resolvedClassMeta.classKey, resolvedClassMeta);
      }

      const isManualWithoutSubmission = Boolean(attempt?.isManualWithoutSubmission);
      const attemptStatus = isManualWithoutSubmission
        ? 'NOT_SUBMITTED'
        : (attempt?.status || 'NOT_SUBMITTED');
      const hasSubmitted = Boolean(attempt && attemptStatus !== 'IN_PROGRESS' && !isManualWithoutSubmission);
      const evaluationStatus = isManualWithoutSubmission
        ? 'MANUAL_ENTRY'
        : !attempt || attemptStatus === 'IN_PROGRESS'
        ? 'PENDING'
        : attempt.needsReview
        ? 'NEEDS_REVIEW'
        : attemptStatus === 'EVALUATED'
        ? 'COMPLETED'
        : 'PENDING';

      roster.push({
        id: attempt?.id || null,
        userId: studentId,
        quizId,
        hasSubmitted,
        isManualWithoutSubmission,
        evaluationStatus,
        needsReview: Boolean(attempt?.needsReview),
        resultUpdatedAt: attempt?.resultUpdatedAt || null,
        status: attemptStatus,
        startTime: isManualWithoutSubmission ? null : (attempt?.startTime || null),
        endTime: isManualWithoutSubmission ? null : (attempt?.endTime || null),
        objectiveScore: attempt ? attempt.objectiveScore : null,
        writtenScore: attempt ? attempt.writtenScore : null,
        totalScore: attempt ? attempt.totalScore : null,
        facultyFeedback: attempt?.facultyFeedback || null,
        violationReason: attempt?.violationReason || null,
        violationCount: attempt?.violationCount ?? 0,
        violations: attempt?.violations || [],
        restartAuthorized: Boolean(attempt?.restartAuthorized),
        restartAuthorizedAt: attempt?.restartAuthorizedAt || null,
        responses: attempt?.responses || [],
        classKey: resolvedClassMeta.classKey,
        classLabel: resolvedClassMeta.classLabel,
        classShortLabel: resolvedClassMeta.shortLabel,
        user: {
          id: studentId,
          name: student.name,
          rollNumber: student.rollNumber,
          email: student.email,
          departmentId: student.departmentId || null,
          sectionId: student.sectionId || null,
          department: student.department || null,
          section: student.section || null,
        },
      });
    };

    for (const student of eligibleStudents as any[]) {
      pushRosterRow(student, attemptByUserId.get(student.id) || null);
    }
    for (const attempt of attempts as any[]) {
      const student = attempt.user || attempt.student;
      if (student?.id) {
        pushRosterRow(student, attempt);
      }
    }

    const submittedCount = roster.filter(r => r.hasSubmitted).length;
    const violatedCount = roster.filter(r => Boolean(r.violationReason)).length;
    const summary = {
      totalAssigned: roster.length,
      submitted: submittedCount,
      notSubmitted: roster.length - submittedCount,
      violated: violatedCount,
    };

    const resolvedQuizQuestions = Array.isArray((quiz as any).questions)
      ? await resolveQuestionImages((quiz as any).questions)
      : [];

    res.status(200).json({
      status: 'success',
      quiz: {
        id: quiz.id,
        title: quiz.title,
        subject: quiz.subject,
        totalMarks: quiz.totalMarks,
        answersPublished: quiz.answersPublished,
        questions: resolvedQuizQuestions,
      },
      data: attempts,
      roster,
      assignedClasses: Array.from(classMap.values()).map(c => ({
        id: c.classKey,
        label: c.classLabel,
        shortLabel: c.shortLabel,
        batchName: c.batchName,
        departmentId: c.departmentId,
        departmentName: c.departmentName,
        sectionId: c.sectionId,
        sectionName: c.sectionName,
      })),
      summary,
    });
  } catch (error) {
    next(error);
  }
};

// Evaluate written questions
export const evaluateAttempt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attemptId = req.params.attemptId as string;
    const { evaluations, writtenScore: rawWrittenScore, facultyFeedback, performanceCategory, finalGrade } = req.body;

    const attempt = await prisma.quizAttempt.findUnique({ 
      where: { id: attemptId },
      include: {
        quiz: { select: { id: true, createdBy: true } },
        user: { select: { id: true, departmentId: true, sectionId: true } },
        responses: {
          include: {
            question: { select: { id: true, type: true, marks: true } }
          }
        }
      }
    });
    if (!attempt) throw new BadRequestError('Attempt not found', 'NOT_FOUND');

    const facultyUserId = (req as any).user?.userId;
    const facultyRole = (req as any).user?.role;

    // Authorization verification: ADMINs can evaluate any attempt.
    // FACULTY must either have created the quiz or be mapped to the student's cohort.
    if (facultyRole !== 'ADMIN' && facultyUserId) {
      const isQuizCreator = attempt.quiz.createdBy === facultyUserId;
      
      let isMapped = false;
      if (!isQuizCreator) {
        const studentDeptId = attempt.user?.departmentId;
        const studentSecId = attempt.user?.sectionId;

        if (studentDeptId) {
          const deptMap = await prisma.facultyDepartment.findFirst({
            where: { userId: facultyUserId, departmentId: studentDeptId }
          });
          if (deptMap) isMapped = true;
        }

        if (!isMapped && studentSecId) {
          const secMap = await prisma.facultySection.findFirst({
            where: { userId: facultyUserId, sectionId: studentSecId }
          });
          if (secMap) isMapped = true;
        }
      }

      if (!isQuizCreator && !isMapped) {
        throw new ForbiddenError(
          'You are not authorized to evaluate this quiz attempt.',
          'ERR_FORBIDDEN_ATTEMPT_EVALUATION'
        );
      }
    }

    const responseById = new Map<string, any>(
      (attempt.responses || []).map((r: any) => [r.id, r])
    );

    const manualUpdates: Array<{ responseId: string; marks: number }> = [];

    if (evaluations && Array.isArray(evaluations)) {
      const seenResponseIds = new Set<string>();
      for (const evalItem of evaluations) {
        if (!evalItem || typeof evalItem.responseId !== 'string') {
          throw new BadRequestError('Invalid evaluation item', 'INVALID_INPUT');
        }
        const resp = responseById.get(evalItem.responseId);
        if (!resp) {
          throw new BadRequestError('Evaluation response does not belong to this attempt', 'INVALID_RESPONSE_ID');
        }
        if (seenResponseIds.has(evalItem.responseId)) {
          continue;
        }
        seenResponseIds.add(evalItem.responseId);

        // For submitted attempts, objective questions are auto-graded and accounted for in objectiveScore.
        // Permit faculty override when explicitly requested (allowObjectiveOverride / evalItem.override).
        // For unsubmitted manual evaluations (isManualWithoutSubmission), all entered marks are manual/written.
        const isObjective = Boolean(resp.question && OBJECTIVE_TYPES.includes(resp.question.type));
        const isExplicitOverride = Boolean(req.body.allowObjectiveOverride || evalItem.override);
        if (!attempt.isManualWithoutSubmission && isObjective && !isExplicitOverride) {
          continue;
        }

        const numericMarks = Number(evalItem.marks);
        const maxMarks = Number(resp.question?.marks ?? 0);
        if (!Number.isFinite(numericMarks) || numericMarks < 0 || numericMarks > maxMarks) {
          throw new BadRequestError(
            `Awarded marks must be between 0 and ${maxMarks}`,
            'INVALID_MARKS'
          );
        }

        manualUpdates.push({ responseId: evalItem.responseId, marks: numericMarks });
      }
    } else if (rawWrittenScore !== undefined) {
      const numericRaw = Number(rawWrittenScore);
      if (!Number.isFinite(numericRaw) || numericRaw < 0) {
        throw new BadRequestError('Written score must be a non-negative number', 'INVALID_MARKS');
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const changedResponses: Array<{ responseId: string; questionId: string; previous: number | null; updated: number }> = [];
      for (const item of manualUpdates) {
        const prev = responseById.get(item.responseId);
        const prevMarks = prev?.marksAwarded ?? null;
        if (prevMarks !== item.marks) {
          changedResponses.push({
            responseId: item.responseId,
            questionId: prev?.questionId,
            previous: prevMarks,
            updated: item.marks,
          });
        }
        await tx.quizResponse.update({
          where: { id: item.responseId },
          data: { marksAwarded: item.marks }
        });
      }

      let writtenScore = 0;
      let effectiveObjectiveScore = attempt.isManualWithoutSubmission ? 0 : Number(attempt.objectiveScore ?? 0);

      if (evaluations && Array.isArray(evaluations)) {
        const updatedMap = new Map(manualUpdates.map((m) => [m.responseId, m.marks]));
        if (req.body.allowObjectiveOverride === true) {
          let newObjScore = 0;
          for (const resp of attempt.responses || []) {
            const isObj = Boolean(resp.question && OBJECTIVE_TYPES.includes(resp.question.type));
            const marks = updatedMap.has(resp.id)
              ? updatedMap.get(resp.id)!
              : Number(resp.marksAwarded ?? 0);
            if (isObj) {
              newObjScore += marks;
            } else {
              writtenScore += marks;
            }
          }
          effectiveObjectiveScore = newObjScore;
        } else {
          for (const resp of attempt.responses || []) {
            if (!attempt.isManualWithoutSubmission && resp.question && OBJECTIVE_TYPES.includes(resp.question.type)) {
              continue;
            }
            const marks = updatedMap.has(resp.id)
              ? updatedMap.get(resp.id)!
              : Number(resp.marksAwarded ?? 0);
            writtenScore += marks;
          }
        }
      } else if (rawWrittenScore !== undefined) {
        writtenScore = Number(rawWrittenScore);
      }

      const totalScore = effectiveObjectiveScore + writtenScore;
      const feedbackChanged = (facultyFeedback ?? null) !== (attempt.facultyFeedback ?? null);
      const scoreChanged =
        Math.abs(writtenScore - Number(attempt.writtenScore ?? 0)) > 1e-6 ||
        Math.abs(totalScore - Number(attempt.totalScore ?? 0)) > 1e-6;
      const hasMeaningfulChange = changedResponses.length > 0 || scoreChanged || feedbackChanged || attempt.status !== 'EVALUATED' || Boolean(attempt.needsReview);

      const savedAttempt = await tx.quizAttempt.update({
        where: { id: attemptId },
        data: {
          objectiveScore: effectiveObjectiveScore,
          writtenScore,
          totalScore,
          facultyFeedback,
          performanceCategory: performanceCategory || null,
          finalGrade: finalGrade || null,
          status: 'EVALUATED',
          needsReview: false,
          ...(scoreChanged ? { resultUpdatedAt: new Date() } : {}),
        }
      });

      if (hasMeaningfulChange && facultyUserId) {
        await tx.quizEvaluationAudit.create({
          data: {
            quizId: attempt.quizId,
            attemptId,
            studentId: attempt.userId,
            facultyId: facultyUserId,
            action: attempt.status === 'EVALUATED' ? 'MANUAL_EVAL_UPDATE' : 'MANUAL_EVAL_CREATE',
            previousValue: {
              writtenScore: attempt.writtenScore,
              totalScore: attempt.totalScore,
              facultyFeedback: attempt.facultyFeedback,
              responses: changedResponses.map((c) => ({ responseId: c.responseId, questionId: c.questionId, marks: c.previous })),
            },
            updatedValue: {
              writtenScore,
              totalScore,
              facultyFeedback: facultyFeedback ?? null,
              responses: changedResponses.map((c) => ({ responseId: c.responseId, questionId: c.questionId, marks: c.updated })),
            },
            note: attempt.isManualWithoutSubmission ? 'Manual faculty evaluation (unsubmitted student)' : 'Manual faculty evaluation',
          },
        });
      }

      return savedAttempt;
    });

    res.status(200).json({ status: 'success', data: updated });
  } catch (error) {
    next(error);
  }
};

// Manually enter/update marks for an unsubmitted student assigned to a quiz
export const evaluateStudentForQuiz = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quizId = req.params.quizId as string;
    const studentId = req.params.studentId as string;
    const { evaluations, facultyFeedback, performanceCategory, finalGrade } = req.body;

    const facultyUserId = (req as any).user?.userId;
    const facultyRole = (req as any).user?.role;

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: true,
        targetDepartments: { select: { departmentId: true } },
        targetSections: { select: { sectionId: true } },
        targetStudents: { select: { userId: true } },
      },
    });
    if (!quiz) throw new NotFoundError('Quiz not found', 'NOT_FOUND');
    if (facultyRole !== 'ADMIN' && quiz.createdBy !== facultyUserId) {
      throw new ForbiddenError('You are not authorized to evaluate students for this quiz.', 'ERR_FORBIDDEN_ATTEMPT_EVALUATION');
    }

    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, role: true, departmentId: true, sectionId: true },
    });
    if (!student || student.role !== 'STUDENT') {
      throw new NotFoundError('Student not found', 'NOT_FOUND');
    }

    // Enforce that the student is actually assigned to this quiz
    const hasTargets =
      quiz.targetStudents.length > 0 ||
      quiz.targetSections.length > 0 ||
      quiz.targetDepartments.length > 0;
    const isAssigned = !hasTargets
      || quiz.targetStudents.some((t) => t.userId === studentId)
      || (student.sectionId ? quiz.targetSections.some((t) => t.sectionId === student.sectionId) : false)
      || (student.departmentId ? quiz.targetDepartments.some((t) => t.departmentId === student.departmentId) : false);

    if (!isAssigned) {
      throw new ForbiddenError('Student is not assigned to this quiz.', 'ERR_STUDENT_NOT_ASSIGNED');
    }

    const questionById = new Map<string, any>((quiz.questions || []).map((q: any) => [q.id, q]));
    const manualUpdates: Array<{ questionId: string; marks: number }> = [];

    if (evaluations && Array.isArray(evaluations)) {
      const seenQuestionIds = new Set<string>();
      for (const evalItem of evaluations) {
        if (!evalItem || typeof evalItem.questionId !== 'string') {
          throw new BadRequestError('Invalid evaluation item', 'INVALID_INPUT');
        }
        const question = questionById.get(evalItem.questionId);
        if (!question) {
          throw new BadRequestError('Question does not belong to this quiz', 'INVALID_QUESTION_ID');
        }
        if (seenQuestionIds.has(evalItem.questionId)) continue;
        seenQuestionIds.add(evalItem.questionId);

        const numericMarks = Number(evalItem.marks);
        const maxMarks = Number(question.marks ?? 0);
        if (!Number.isFinite(numericMarks) || numericMarks < 0 || numericMarks > maxMarks) {
          throw new BadRequestError(`Awarded marks must be between 0 and ${maxMarks}`, 'INVALID_MARKS');
        }
        manualUpdates.push({ questionId: evalItem.questionId, marks: numericMarks });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      let attempt = await tx.quizAttempt.findFirst({
        where: { quizId, userId: studentId },
        include: { responses: true },
        orderBy: { createdAt: 'desc' },
      });

      const isNewManualAttempt = !attempt;
      if (!attempt) {
        attempt = await tx.quizAttempt.create({
          data: {
            quizId,
            userId: studentId,
            status: 'EVALUATED',
            isManualWithoutSubmission: true,
            endTime: null,
            objectiveScore: 0,
            writtenScore: 0,
            totalScore: 0,
          },
          include: { responses: true },
        });
      } else if (!attempt.isManualWithoutSubmission && attempt.status !== 'IN_PROGRESS') {
        throw new BadRequestError('Student already submitted an attempt; evaluate the attempt directly.', 'ATTEMPT_ALREADY_SUBMITTED');
      }

      const prevRespByQ = new Map<string, number | null>(
        (attempt.responses || []).map((r: any) => [r.questionId, r.marksAwarded ?? null])
      );
      const changedResponses: Array<{ questionId: string; previous: number | null; updated: number }> = [];

      for (const item of manualUpdates) {
        const prevMarks = prevRespByQ.get(item.questionId) ?? null;
        if (prevMarks !== item.marks) {
          changedResponses.push({ questionId: item.questionId, previous: prevMarks, updated: item.marks });
        }
        await tx.quizResponse.upsert({
          where: { attemptId_questionId: { attemptId: attempt.id, questionId: item.questionId } },
          create: {
            attemptId: attempt.id,
            questionId: item.questionId,
            status: 'NOT_VISITED',
            marksAwarded: item.marks,
          },
          update: {
            marksAwarded: item.marks,
          },
        });
      }

      const latestResponses = await tx.quizResponse.findMany({ where: { attemptId: attempt.id } });
      const writtenScore = latestResponses.reduce((sum, r) => sum + Number(r.marksAwarded ?? 0), 0);
      const totalScore = writtenScore;
      const feedbackChanged = (facultyFeedback ?? null) !== (attempt.facultyFeedback ?? null);
      const scoreChanged =
        Math.abs(writtenScore - Number(attempt.writtenScore ?? 0)) > 1e-6 ||
        Math.abs(totalScore - Number(attempt.totalScore ?? 0)) > 1e-6;

      const savedAttempt = await tx.quizAttempt.update({
        where: { id: attempt.id },
        data: {
          isManualWithoutSubmission: true,
          endTime: null,
          objectiveScore: 0,
          writtenScore,
          totalScore,
          facultyFeedback,
          performanceCategory: performanceCategory || null,
          finalGrade: finalGrade || null,
          status: 'EVALUATED',
          needsReview: false,
          ...(scoreChanged || isNewManualAttempt ? { resultUpdatedAt: new Date() } : {}),
        },
      });

      if ((isNewManualAttempt || changedResponses.length > 0 || scoreChanged || feedbackChanged) && facultyUserId) {
        await tx.quizEvaluationAudit.create({
          data: {
            quizId,
            attemptId: attempt.id,
            studentId,
            facultyId: facultyUserId,
            action: isNewManualAttempt ? 'MANUAL_EVAL_CREATE' : 'MANUAL_EVAL_UPDATE',
            previousValue: isNewManualAttempt
              ? undefined
              : {
                  writtenScore: attempt.writtenScore,
                  totalScore: attempt.totalScore,
                  facultyFeedback: attempt.facultyFeedback,
                  responses: changedResponses.map((c) => ({ questionId: c.questionId, marks: c.previous })),
                },
            updatedValue: {
              writtenScore,
              totalScore,
              facultyFeedback: facultyFeedback ?? null,
              responses: changedResponses.map((c) => ({ questionId: c.questionId, marks: c.updated })),
            },
            note: 'Manual faculty evaluation for unsubmitted student',
          },
        });
      }

      return savedAttempt;
    });

    res.status(200).json({ status: 'success', data: updated });
  } catch (error) {
    next(error);
  }
};

export const publishQuizAnswers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quizId = req.params.quizId as string;
    const { publish } = req.body ?? {};
    
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;
    
    const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
    if (!quiz) throw new NotFoundError('Quiz not found', 'NOT_FOUND');
    
    if (userRole !== 'ADMIN' && (!userId || quiz.createdBy !== userId)) {
      throw new ForbiddenError('Not authorized to publish answers for this quiz', 'FORBIDDEN');
    }

    if (publish === false) {
      throw new BadRequestError('Published quiz answers cannot be unpublished.', 'INVALID_OPERATION');
    }

    if (quiz.answersPublished) {
      throw new BadRequestError('Answers have already been published for this quiz.', 'ALREADY_PUBLISHED');
    }
    
    const updated = await prisma.quiz.update({
      where: { id: quizId },
      data: { answersPublished: true }
    });
    
    res.status(200).json({ status: 'success', data: updated });
  } catch (error) {
    next(error);
  }
};

import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import * as cheerio from 'cheerio';

// Upload DOCX and parse it natively in Node (No python needed)
export const uploadDocxParser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      throw new BadRequestError('No file uploaded', 'INVALID_INPUT');
    }

    const filePath = path.resolve(req.file.path);
    
    try {
      const result = await mammoth.convertToHtml({ path: filePath });
      const html = result.value;
      const $ = cheerio.load(html);
      
      const metadata: any = {
        title: '',
        subject: '',
        totalMarks: 0,
        totalQuestions: 0,
        instructions: ''
      };
      
      const questions: any[] = [];
      let currentQ: any = null;
      let currentList: 'LEFT' | 'RIGHT' | 'MAPPING' | null = null;
      let currentQNumber = 0;

      const elements = $('h1, h2, h3, h4, h5, h6, p, li, img').toArray();

      const validateQuestionCompleteness = (q: any, num: number) => {
        if (!q.text && !q.image) {
          throw new BadRequestError(`Validation Failed: Question ${num} must have either Question Text or an Image.`, 'VALIDATION_ERROR');
        }
        if (!q.marks) {
          throw new BadRequestError(`Validation Failed: Question ${num} is missing Marks.`, 'VALIDATION_ERROR');
        }
        if (q.type === 'MCQ' && (!q.answerKey || q.options.filter(Boolean).length < 2)) {
          throw new BadRequestError(`Validation Failed: Question ${num} (Multiple Choice) is missing options or Correct Answer.`, 'VALIDATION_ERROR');
        }
        if (q.type === 'MATCHING' && q.options.length === 0) {
          throw new BadRequestError(`Validation Failed: Question ${num} (Match the Following) has invalid or missing mappings.`, 'VALIDATION_ERROR');
        }
        if (['SHORT_WRITTEN', 'LONG_WRITTEN', 'NUMERICAL', 'FILL_BLANK'].includes(q.type) && q.answerKey === null) {
          throw new BadRequestError(`Validation Failed: Question ${num} is missing expected answer.`, 'VALIDATION_ERROR');
        }
      };

      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        
        if (el.tagName === 'img') {
          const src = $(el).attr('src');
          if (src && currentQ) {
            try {
              if (src.startsWith('data:image/')) {
                const match = src.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
                if (match) {
                  const rawExt = match[1].toLowerCase();
                  const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
                  const mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
                  const buffer = Buffer.from(match[2], 'base64');
                  const url = await uploadBufferToObjectStorage(buffer, mimeType);
                  currentQ.image = url || src;
                } else {
                  currentQ.image = src;
                }
              } else if (fs.existsSync(src)) {
                const url = await uploadToObjectStorage(src);
                if (url) currentQ.image = url;
              } else {
                currentQ.image = src;
              }
            } catch (err) {
              console.error('Image upload failed', err);
              currentQ.image = src;
            }
          }
          continue;
        }

        let text = $(el).text().trim();
        if (!text) continue;
        
        // Remove zero-width spaces or weird chars if any
        text = text.replace(/[\u200B-\u200D\uFEFF]/g, '');

        if (text.startsWith('Quiz Title:')) metadata.title = text.substring(11).trim();
        else if (text.startsWith('Subject:')) metadata.subject = text.substring(8).trim();
        else if (text.startsWith('Instructions:')) metadata.instructions = text.substring(13).trim();
        else if (text.startsWith('Total Marks:')) metadata.totalMarks = Number(text.substring(12).trim()) || 0;
        else if (text.startsWith('Total Number of Questions:')) metadata.totalQuestions = Number(text.substring(26).trim()) || 0;
        
        else if (text.startsWith('Question Number:')) {
          if (currentQ) {
            if (currentQ.type === 'MATCHING') {
              for (const m of currentQ._mapping) {
                const parts = m.split('->').map((s: string) => s.trim());
                if (parts.length === 2) {
                  const leftIdx = parseInt(parts[0]) - 1;
                  const rightIdx = parts[1].toUpperCase().charCodeAt(0) - 65;
                  if (leftIdx >= 0 && leftIdx < currentQ._left.length && rightIdx >= 0 && rightIdx < currentQ._right.length) {
                    currentQ.options.push({ left: currentQ._left[leftIdx], right: currentQ._right[rightIdx] });
                  }
                }
              }
            }
            validateQuestionCompleteness(currentQ, currentQNumber);
            questions.push(currentQ);
          }
          currentQNumber = Number(text.substring(16).trim()) || (currentQNumber + 1);
          currentQ = {
            type: 'MCQ', text: '', marks: 1, options: [], answerKey: null, explanation: null, hasImagePlaceholder: false,
            _left: [], _right: [], _mapping: []
          };
          currentList = null;
        }
        else if (currentQ) {
          if (text.startsWith('Question Type:')) {
            const qt = text.substring(14).trim().toLowerCase();
            if (qt.includes('multiple choice')) currentQ.type = 'MCQ';
            else if (qt.includes('numerical')) currentQ.type = 'NUMERICAL';
            else if (qt.includes('short answer')) currentQ.type = 'SHORT_WRITTEN';
            else if (qt.includes('long answer')) currentQ.type = 'LONG_WRITTEN';
            else if (qt.includes('match')) currentQ.type = 'MATCHING';
            else if (qt.includes('fill') || qt.includes('blank')) currentQ.type = 'FILL_BLANK';
          }
          else if (text.startsWith('Question Text:')) currentQ.text = text.substring(14).trim();
          else if (text.startsWith('Image:')) {
            if (!text.toLowerCase().includes('n/a')) currentQ.hasImagePlaceholder = true;
          }
          else if (text.startsWith('Marks:')) currentQ.marks = Number(text.substring(6).trim()) || 1;
          else if (text.startsWith('Explanation:')) currentQ.explanation = text.substring(12).trim();
          
          else if (text.startsWith('Option A:')) currentQ.options[0] = text.substring(9).trim();
          else if (text.startsWith('Option B:')) currentQ.options[1] = text.substring(9).trim();
          else if (text.startsWith('Option C:')) currentQ.options[2] = text.substring(9).trim();
          else if (text.startsWith('Option D:')) currentQ.options[3] = text.substring(9).trim();
          
          else if (text.startsWith('Correct Answer:')) {
            const ansRaw = text.substring(15).trim();
            if (ansRaw.length === 1 && "ABCDEF".includes(ansRaw.toUpperCase())) {
               const idx = ansRaw.toUpperCase().charCodeAt(0) - 65;
               if (idx >= 0 && idx <= 3 && currentQ.options[idx]) {
                  currentQ.answerKey = currentQ.options[idx];
               } else {
                  currentQ.answerKey = ansRaw;
               }
            } else {
               currentQ.answerKey = ansRaw;
            }
          }
          else if (text.startsWith('Correct Numerical Answer:')) currentQ.answerKey = Number(text.substring(25).trim());
          else if (text.startsWith('Expected Answer / Evaluation Guidelines:')) currentQ.answerKey = text.substring(40).trim();
          else if (text.startsWith('Expected Answer:')) currentQ.answerKey = text.substring(16).trim();
          
          else if (text === 'Left Column') currentList = 'LEFT';
          else if (text === 'Right Column') currentList = 'RIGHT';
          else if (text === 'Correct Mapping') currentList = 'MAPPING';
          
          else if (currentList === 'LEFT') {
             const val = text.replace(/^\d+\.\s*/, '').trim();
             if (val) currentQ._left.push(val);
          }
          else if (currentList === 'RIGHT') {
             const val = text.replace(/^[A-Z]\.\s*/i, '').trim();
             if (val) currentQ._right.push(val);
          }
          else if (currentList === 'MAPPING' && text.includes('->')) currentQ._mapping.push(text);
          else {
            // Append to text if it's not a known field and we aren't parsing options/lists
            if (!currentList && currentQ.options.length === 0 && !text.includes('Question Information') && !text.includes('Question Sections')) {
               currentQ.text += (currentQ.text ? '\n' : '') + text;
            }
          }
        }
      }

      if (currentQ) {
        if (currentQ.type === 'MATCHING') {
          for (const m of currentQ._mapping) {
            const parts = m.split('->').map((s: string) => s.trim());
            if (parts.length === 2) {
              const leftIdx = parseInt(parts[0]) - 1;
              const rightIdx = parts[1].toUpperCase().charCodeAt(0) - 65;
              if (leftIdx >= 0 && leftIdx < currentQ._left.length && rightIdx >= 0 && rightIdx < currentQ._right.length) {
                currentQ.options.push({ left: currentQ._left[leftIdx], right: currentQ._right[rightIdx] });
              }
            }
          }
        }
        validateQuestionCompleteness(currentQ, currentQNumber);
        questions.push(currentQ);
      }

      if (metadata.totalQuestions && questions.length !== metadata.totalQuestions) {
         throw new BadRequestError(`Parsed questions count (${questions.length}) does not match metadata Total Number of Questions (${metadata.totalQuestions}).`, 'VALIDATION_ERROR');
      }

      // Clean up uploaded docx
      fs.unlinkSync(filePath);

      res.status(200).json({ status: 'success', data: { metadata, questions } });
    } catch (parseErr: any) {
      console.error('DOCX parsing error:', parseErr);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      throw new BadRequestError(parseErr.message || 'Failed to parse docx document', 'PARSE_ERROR');
    }
  } catch (error) {
    next(error);
  }
};

// Upload single image (for inline image management)
export const uploadImageHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      throw new BadRequestError('No image uploaded', 'INVALID_INPUT');
    }

    const filePath = path.resolve(req.file.path);
    const url = await uploadToObjectStorage(filePath);

    if (!url) {
      throw new BadRequestError('Failed to upload image to object storage', 'UPLOAD_ERROR');
    }

    res.status(200).json({ status: 'success', data: { url } });
  } catch (error) {
    next(error);
  }
};

// Get Live 30-Second Rolling Access OTP for faculty proctoring
export const getLiveQuizOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quizId = req.params.quizId as string;
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;

    const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
    if (!quiz) throw new NotFoundError('Quiz not found', 'NOT_FOUND');

    if (userRole !== 'ADMIN' && quiz.createdBy !== userId) {
      throw new ForbiddenError('Not authorized to access live access code for this quiz', 'FORBIDDEN');
    }

    const otp = generateQuizOtp(quizId);
    const remainingSeconds = getOtpRemainingSeconds();

    res.status(200).json({
      status: 'success',
      data: {
        quizId,
        otp,
        remainingSeconds,
        stepSeconds: 30,
        expiresAt: new Date(Date.now() + remainingSeconds * 1000).toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get Curriculum & Distinct Topics for dropdown selection
export const getQuizTopics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const defaultTopics = [
      'Data Structures',
      'Algorithms',
      'Object-Oriented Programming',
      'Database Management Systems',
      'Operating Systems',
      'Computer Networks',
      'Software Engineering',
      'Web Technologies',
      'Artificial Intelligence',
      'Machine Learning',
      'Cybersecurity',
      'Discrete Mathematics',
      'Computer Architecture',
      'Cloud Computing',
      'Theory of Computation'
    ];

    const [dbTopics, questionTopics] = await Promise.all([
      prisma.topic.findMany({ select: { name: true }, orderBy: { name: 'asc' } }),
      prisma.question.findMany({
        where: { topic: { not: null } },
        select: { topic: true },
        distinct: ['topic']
      })
    ]);

    const uniqueSet = new Set<string>();
    defaultTopics.forEach((t) => uniqueSet.add(t));
    dbTopics.forEach((t) => t.name?.trim() && uniqueSet.add(t.name.trim()));
    questionTopics.forEach((q) => q.topic?.trim() && uniqueSet.add(q.topic.trim()));

    const topics = Array.from(uniqueSet).sort((a, b) => a.localeCompare(b));
    res.status(200).json({ status: 'success', data: { topics } });
  } catch (error) {
    next(error);
  }
};



