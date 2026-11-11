import { Request, Response, NextFunction } from 'express';
import { randomInt } from 'crypto';
import { PaperStatus, QuestionCategory } from '@prisma/client';
import { prisma } from '../config/prisma';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';
import { buildPaperQuestionPoolWhere, hasOppositeCategoryReuse, MAX_PAPER_QUESTIONS, parsePaperQuestions, shuffleQuestions } from '../utils/question-paper-policy';

const paperInclude = {
  questions: true,
  questionUsages: { include: { question: true }, orderBy: { sortOrder: 'asc' as const } },
  targetDepartments: { include: { department: { select: { id: true, name: true, batch: { select: { name: true, startYear: true } } } } } },
  targetSections: { include: { section: { select: { id: true, name: true, department: { select: { name: true, batch: { select: { name: true, startYear: true } } } } } } } },
  _count: { select: { attempts: true } },
};

const actorId = (req: Request) => req.user?.userId;
const isAdmin = (req: Request) => req.user?.role === 'ADMIN';
const ensureActor = (req: Request) => {
  const userId = actorId(req);
  if (!userId) throw new BadRequestError('Authenticated identity is required.', 'ERR_AUTH_REQUIRED');
  return userId;
};

const getAccessiblePaper = async (req: Request) => {
  const userId = ensureActor(req);
  const paper = await prisma.quiz.findFirst({
    where: { id: req.params.paperId as string, paperCategory: { not: null }, ...(isAdmin(req) ? {} : { createdBy: userId }) },
    include: paperInclude,
  });
  if (!paper) throw new NotFoundError('Question paper was not found.', 'ERR_PAPER_NOT_FOUND');
  return paper;
};

const toPaperResponse = (paper: any) => {
  const selected = [
    ...paper.questionUsages.map((usage: any) => ({ ...usage.question, marks: usage.marks, sortOrder: usage.sortOrder, wasReused: usage.wasReused })),
    ...paper.questions.map((question: any, index: number) => ({ ...question, sortOrder: paper.questionUsages.length + index, wasReused: false })),
  ].sort((a: any, b: any) => a.sortOrder - b.sortOrder);
  const department = paper.targetDepartments[0]?.department;
  const section = paper.targetSections[0]?.section;
  const classLabel = section
    ? `${section.department.name} · ${section.department.batch.name} · Section ${section.name}`
    : department ? `${department.name} · ${department.batch.name}` : null;
  const totalMarks = selected.reduce((sum: number, question: any) => sum + Number(question.marks || 0), 0);
  return { ...paper, questions: selected, totalMarks, classLabel, ...currentClassSelection(paper) };
};

const validateTitle = (title: unknown) => {
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 200) throw new BadRequestError('Paper title is required and must be at most 200 characters.', 'ERR_INVALID_PAPER_TITLE');
  return title.trim();
};

const validateDateRange = (startValue: unknown, endValue: unknown) => {
  const startDate = startValue ? new Date(String(startValue)) : null;
  const endDate = endValue ? new Date(String(endValue)) : null;
  if (startDate && !Number.isFinite(startDate.getTime())) throw new BadRequestError('Start date is invalid.', 'ERR_INVALID_PAPER_DATE');
  if (endDate && !Number.isFinite(endDate.getTime())) throw new BadRequestError('End date is invalid.', 'ERR_INVALID_PAPER_DATE');
  if (startDate && endDate && endDate <= startDate) throw new BadRequestError('End date must be after start date.', 'ERR_INVALID_PAPER_DATE_RANGE');
  return { startDate, endDate };
};

const assertClassAccess = async (req: Request, classType: unknown, classId: unknown) => {
  if (classType !== 'DEPARTMENT' && classType !== 'SECTION') throw new BadRequestError('Choose a department or section class.', 'ERR_INVALID_PAPER_CLASS');
  if (typeof classId !== 'string' || !classId.trim()) throw new BadRequestError('Choose the class for this paper.', 'ERR_INVALID_PAPER_CLASS');
  if (!isAdmin(req)) {
    const allowedIds = classType === 'DEPARTMENT' ? req.facultyScope?.departmentIds : req.facultyScope?.sectionIds;
    if (!allowedIds?.includes(classId)) throw new ForbiddenError('You are not assigned to publish papers for this class.', 'ERR_PAPER_CLASS_FORBIDDEN');
  }
  if (classType === 'DEPARTMENT') {
    const department = await prisma.department.findUnique({ where: { id: classId }, select: { id: true } });
    if (!department) throw new NotFoundError('Selected department was not found.', 'ERR_PAPER_CLASS_NOT_FOUND');
  } else {
    const section = await prisma.section.findUnique({ where: { id: classId }, select: { id: true } });
    if (!section) throw new NotFoundError('Selected section was not found.', 'ERR_PAPER_CLASS_NOT_FOUND');
  }
  return { classType, classId } as { classType: 'DEPARTMENT' | 'SECTION'; classId: string };
};

const validateSelectionOwnershipAndReuse = async (
  questions: ReturnType<typeof parsePaperQuestions>,
  category: QuestionCategory,
  actor: string,
  admin: boolean,
  includeReused: boolean,
) => {
  const questionIds = questions.map((question) => question.questionId);
  const accessibleOwnership = admin ? {} : { OR: [{ ownerId: actor }, { ownerId: null }, { owner: { is: { role: 'ADMIN' as const } } }] };
  const records = await prisma.question.findMany({
    where: { AND: [{ id: { in: questionIds } }, { archivedAt: null }, accessibleOwnership] },
    include: { usages: { where: { isFinalized: true }, select: { category: true, isFinalized: true } } },
  });
  if (records.length !== questionIds.length) throw new NotFoundError('One or more selected questions are unavailable.', 'ERR_PAPER_QUESTION_NOT_FOUND');
  const byId = new Map(records.map((question) => [question.id, question]));
  const selected = questions.map((selection) => {
    const question = byId.get(selection.questionId)!;
    const wasReused = hasOppositeCategoryReuse(question, category);
    if (wasReused && !includeReused) throw new BadRequestError('A selected question is from or has usage in the opposite category. Enable explicit reuse to include it.', 'ERR_PAPER_REUSE_CONFIRMATION_REQUIRED');
    return { ...selection, wasReused };
  });
  return selected;
};

const persistQuestionSelection = async (tx: any, paper: any, selected: Array<{ questionId: string; marks: number; wasReused: boolean }>) => {
  await tx.questionUsage.deleteMany({ where: { quizId: paper.id, isFinalized: false } });
  if (selected.length) {
    await tx.questionUsage.createMany({
      data: selected.map((selection, sortOrder) => ({
        questionId: selection.questionId,
        category: paper.paperCategory,
        quizId: paper.id,
        assessmentTitle: paper.title,
        marks: selection.marks,
        sortOrder,
        wasReused: selection.wasReused,
        isFinalized: false,
      })),
    });
  }
};

const currentClassSelection = (paper: any) => {
  if (paper.targetDepartments.length === 1 && paper.targetSections.length === 0) return { classType: 'DEPARTMENT' as const, classId: paper.targetDepartments[0].departmentId };
  if (paper.targetSections.length === 1 && paper.targetDepartments.length === 0) return { classType: 'SECTION' as const, classId: paper.targetSections[0].sectionId };
  return null;
};

export const getPaperClasses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = ensureActor(req);
    const departmentIds = isAdmin(req) ? undefined : req.facultyScope?.departmentIds || [];
    const sectionIds = isAdmin(req) ? undefined : req.facultyScope?.sectionIds || [];
    const [departments, sections] = await Promise.all([
      prisma.department.findMany({ where: departmentIds ? { id: { in: departmentIds } } : {}, select: { id: true, name: true, batch: { select: { name: true, startYear: true } } }, orderBy: { name: 'asc' } }),
      prisma.section.findMany({ where: sectionIds ? { id: { in: sectionIds } } : {}, select: { id: true, name: true, department: { select: { name: true, batch: { select: { name: true, startYear: true } } } } }, orderBy: { name: 'asc' } }),
    ]);
    void userId;
    res.status(200).json({ status: 'success', data: { classes: [
      ...departments.map((department) => ({ id: department.id, type: 'DEPARTMENT', name: department.name, batch: department.batch.name, year: department.batch.startYear })),
      ...sections.map((section) => ({ id: section.id, type: 'SECTION', name: `${section.department.name} · Section ${section.name}`, batch: section.department.batch.name, year: section.department.batch.startYear })),
    ] } });
  } catch (error) { next(error); }
};

export const listQuestionPapers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = ensureActor(req);
    const papers = await prisma.quiz.findMany({
      where: { paperCategory: { not: null }, ...(isAdmin(req) ? {} : { createdBy: userId }) },
      include: paperInclude,
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ status: 'success', data: papers.map(toPaperResponse) });
  } catch (error) { next(error); }
};

export const createQuestionPaper = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = ensureActor(req);
    const category = req.body.category;
    if (!Object.values(QuestionCategory).includes(category)) throw new BadRequestError('Paper category must be ASSIGNMENT or TEST_QUIZ.', 'ERR_INVALID_PAPER_CATEGORY');
    const title = validateTitle(req.body.title);
    const { startDate, endDate } = validateDateRange(req.body.startDate, req.body.endDate);
    const durationMinutes = Number(req.body.durationMinutes || 60);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 480) throw new BadRequestError('Duration must be between 1 and 480 minutes.', 'ERR_INVALID_PAPER_DURATION');
    const paper = await prisma.quiz.create({ data: {
      title,
      subject: typeof req.body.subject === 'string' ? req.body.subject.trim() || null : null,
      instructions: typeof req.body.instructions === 'string' ? req.body.instructions.trim() || null : null,
      startDate, endDate, durationMinutes,
      createdBy: userId,
      paperCategory: category,
      paperStatus: 'DRAFT',
      totalMarks: 0,
    } });
    res.status(201).json({ status: 'success', data: toPaperResponse(await prisma.quiz.findUniqueOrThrow({ where: { id: paper.id }, include: paperInclude })) });
  } catch (error) { next(error); }
};

export const getQuestionPaper = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const paper = await getAccessiblePaper(req);
    res.status(200).json({ status: 'success', data: toPaperResponse(paper) });
  } catch (error) { next(error); }
};

export const updateQuestionPaper = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = ensureActor(req);
    const paper = await getAccessiblePaper(req);
    if (paper.paperStatus === 'PUBLISHED' || paper.paperStatus === 'CLOSED') throw new BadRequestError('Published or closed papers cannot be edited.', 'ERR_PAPER_NOT_EDITABLE');
    if (req.body.category && req.body.category !== paper.paperCategory) throw new BadRequestError('Paper category is fixed when the paper is created.', 'ERR_PAPER_CATEGORY_LOCKED');
    const title = validateTitle(req.body.title ?? paper.title);
    const { startDate, endDate } = validateDateRange(Object.hasOwn(req.body, 'startDate') ? req.body.startDate : paper.startDate, Object.hasOwn(req.body, 'endDate') ? req.body.endDate : paper.endDate);
    const rawDuration = req.body.durationMinutes ?? paper.durationMinutes;
    const durationMinutes = Number(rawDuration);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 480) throw new BadRequestError('Duration must be between 1 and 480 minutes.', 'ERR_INVALID_PAPER_DURATION');

    const hasClassFields = Object.hasOwn(req.body, 'classType') || Object.hasOwn(req.body, 'classId');
    let selectedClass = currentClassSelection(paper);
    let classUpdate: any = {};
    if (hasClassFields) {
      if (req.body.classId == null || req.body.classId === '') {
        if (req.body.classType && req.body.classId) throw new BadRequestError('Class type and class ID must be supplied together.', 'ERR_INVALID_PAPER_CLASS');
        selectedClass = null;
        classUpdate = { targetDepartments: { deleteMany: {} }, targetSections: { deleteMany: {} } };
      } else {
        selectedClass = await assertClassAccess(req, req.body.classType, req.body.classId);
        const authorizedClass = selectedClass!;
        classUpdate = {
          targetDepartments: { deleteMany: {}, ...(authorizedClass.classType === 'DEPARTMENT' ? { create: [{ departmentId: authorizedClass.classId }] } : {}) },
          targetSections: { deleteMany: {}, ...(authorizedClass.classType === 'SECTION' ? { create: [{ sectionId: authorizedClass.classId }] } : {}) },
        };
      }
    }

    let selected: Array<{ questionId: string; marks: number; wasReused: boolean }> | null = null;
    if (Object.hasOwn(req.body, 'questions')) {
      const parsed = parsePaperQuestions(req.body.questions, true);
      selected = await validateSelectionOwnershipAndReuse(parsed, paper.paperCategory!, userId, isAdmin(req), req.body.includeReused === true);
    }
    const finalQuestionsCount = selected?.length ?? (paper.questionUsages.length + paper.questions.length);
    const totalMarks = selected?.reduce((sum, item) => sum + item.marks, 0) ?? paper.questionUsages.reduce((sum, usage) => sum + usage.marks, 0) + paper.questions.reduce((sum, question) => sum + question.marks, 0);
    const paperStatus: PaperStatus = selectedClass && finalQuestionsCount > 0 ? 'READY' : 'DRAFT';

    await prisma.$transaction(async (tx) => {
      await tx.quiz.update({
        where: { id: paper.id },
        data: {
          title, subject: typeof req.body.subject === 'string' ? req.body.subject.trim() || null : paper.subject,
          instructions: typeof req.body.instructions === 'string' ? req.body.instructions.trim() || null : paper.instructions,
          durationMinutes, startDate, endDate, totalMarks, paperStatus, ...classUpdate,
        },
      });
      if (selected) await persistQuestionSelection(tx, { id: paper.id, title, paperCategory: paper.paperCategory }, selected);
      else if (title !== paper.title) await tx.questionUsage.updateMany({ where: { quizId: paper.id, isFinalized: false }, data: { assessmentTitle: title } });
    });
    const result = await prisma.quiz.findUniqueOrThrow({ where: { id: paper.id }, include: paperInclude });
    res.status(200).json({ status: 'success', data: toPaperResponse(result) });
  } catch (error) { next(error); }
};

export const generateQuestionPaper = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = ensureActor(req);
    const paper = await getAccessiblePaper(req);
    if (paper.paperStatus === 'PUBLISHED' || paper.paperStatus === 'CLOSED') throw new BadRequestError('Only draft or ready papers can be regenerated.', 'ERR_PAPER_NOT_EDITABLE');
    const count = Number(req.body.count);
    if (!Number.isInteger(count) || count < 1 || count > MAX_PAPER_QUESTIONS) throw new BadRequestError(`Question count must be between 1 and ${MAX_PAPER_QUESTIONS}.`, 'ERR_INVALID_GENERATION_COUNT');
    if (paper.questionUsages.length > 0 && req.body.confirmReplace !== true) throw new BadRequestError('Confirm that the current question selection should be replaced before regeneration.', 'ERR_CONFIRM_PAPER_REGENERATION');

    const where = buildPaperQuestionPoolWhere(paper.paperCategory!, userId, {
      includeReused: req.body.includeReused === true,
      subject: typeof req.body.subject === 'string' ? req.body.subject.trim() || undefined : undefined,
      topic: typeof req.body.topic === 'string' ? req.body.topic.trim() || undefined : undefined,
      difficulty: typeof req.body.difficulty === 'string' ? req.body.difficulty : undefined,
      isAdmin: isAdmin(req),
    });
    const pool = await prisma.question.findMany({
      where,
      include: { usages: { where: { isFinalized: true }, select: { category: true, isFinalized: true } } },
    });
    if (pool.length < count) throw new BadRequestError(`Only ${pool.length} eligible questions are available; ${count} were requested. Adjust the filters or explicitly include reused questions.`, 'ERR_INSUFFICIENT_QUESTION_POOL');
    const randomPool = shuffleQuestions(pool, () => randomInt(0, 2 ** 32) / 2 ** 32).slice(0, count);
    const selected = parsePaperQuestions(randomPool.map((question) => ({ questionId: question.id, marks: question.marks }))).map((selection, index) => ({
      ...selection,
      wasReused: hasOppositeCategoryReuse(randomPool[index], paper.paperCategory!),
    }));
    const totalMarks = selected.reduce((sum, question) => sum + question.marks, 0);
    const selectedClass = currentClassSelection(paper);
    const paperStatus: PaperStatus = selectedClass ? 'READY' : 'DRAFT';
    await prisma.$transaction(async (tx) => {
      await persistQuestionSelection(tx, { id: paper.id, title: paper.title, paperCategory: paper.paperCategory }, selected);
      await tx.quiz.update({ where: { id: paper.id }, data: { totalMarks, paperStatus } });
    });
    const result = await prisma.quiz.findUniqueOrThrow({ where: { id: paper.id }, include: paperInclude });
    res.status(200).json({ status: 'success', data: toPaperResponse(result) });
  } catch (error) { next(error); }
};

export const publishQuestionPaper = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const paper = await getAccessiblePaper(req);
    if (paper.paperStatus === 'PUBLISHED') return res.status(200).json({ status: 'success', data: toPaperResponse(paper), message: 'Paper is already published.' });
    if (paper.paperStatus !== 'READY') throw new BadRequestError('Paper must have questions and an authorized class before publishing.', 'ERR_PAPER_NOT_READY');
    if (paper.questionUsages.length === 0 && paper.questions.length === 0) throw new BadRequestError('Paper has no selected questions.', 'ERR_PAPER_QUESTIONS_REQUIRED');
    const classSelection = currentClassSelection(paper);
    if (!classSelection) throw new BadRequestError('Select exactly one authorized department or section class before publishing.', 'ERR_PAPER_CLASS_REQUIRED');
    await assertClassAccess(req, classSelection.classType, classSelection.classId);
    await prisma.$transaction(async (tx) => {
      await tx.quiz.update({ where: { id: paper.id }, data: { paperStatus: 'PUBLISHED' } });
      await tx.questionUsage.updateMany({ where: { quizId: paper.id, isFinalized: false }, data: { isFinalized: true } });
    });
    const published = await prisma.quiz.findUniqueOrThrow({ where: { id: paper.id }, include: paperInclude });
    res.status(200).json({ status: 'success', data: toPaperResponse(published) });
  } catch (error) { next(error); }
};

export const closeQuestionPaper = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const paper = await getAccessiblePaper(req);
    if (paper.paperStatus === 'CLOSED') return res.status(200).json({ status: 'success', data: toPaperResponse(paper), message: 'Paper is already closed.' });
    if (paper.paperStatus !== 'PUBLISHED') throw new BadRequestError('Only published papers can be closed.', 'ERR_PAPER_NOT_PUBLISHED');
    await prisma.quiz.update({ where: { id: paper.id }, data: { paperStatus: 'CLOSED' } });
    const closed = await prisma.quiz.findUniqueOrThrow({ where: { id: paper.id }, include: paperInclude });
    res.status(200).json({ status: 'success', data: toPaperResponse(closed) });
  } catch (error) { next(error); }
};
