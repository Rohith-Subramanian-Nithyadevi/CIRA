import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { assertQuestionEditable, buildQuestionBankWhere, parseQuestionBankFilters, questionReuseStatus, validateQuestionBankPayload } from '../utils/question-bank-policy';
import { uploadToCloudinaryBuffer } from '../utils/cloudinary';

const actorId = (req: Request) => req.user?.userId;
const isAdmin = (req: Request) => req.user?.role === 'ADMIN';

export const listQuestionBank = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = actorId(req);
    if (!userId) throw new BadRequestError('Authenticated identity is required.', 'ERR_AUTH_REQUIRED');
    const filters = parseQuestionBankFilters(req.query as Record<string, unknown>);
    const where = buildQuestionBankWhere(filters, userId, isAdmin(req));
    const [total, questions] = await Promise.all([
      prisma.question.count({ where }),
      prisma.question.findMany({
        where,
        include: { owner: { select: { id: true, name: true, role: true } }, usages: { select: { category: true, assessmentTitle: true, usedAt: true, quizId: true, assignmentId: true, isFinalized: true }, orderBy: { usedAt: 'desc' } } },
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
    ]);
    const items = questions.map((question) => ({
      ...question,
      reuse: questionReuseStatus(question.usages, filters.category),
      ownership: question.ownerId === userId ? 'owned' : question.ownerId && question.owner?.role !== 'ADMIN' ? 'inaccessible' : 'shared',
    }));
    res.status(200).json({ status: 'success', data: { items, pagination: { page: filters.page, limit: filters.limit, total, pages: Math.ceil(total / filters.limit) } } });
  } catch (error) { next(error); }
};

export const createBankQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = actorId(req);
    if (!userId) throw new BadRequestError('Authenticated identity is required.', 'ERR_AUTH_REQUIRED');
    const data = validateQuestionBankPayload(req.body);
    const question = await prisma.question.create({ data: { ...data, ownerId: userId }, include: { owner: { select: { id: true, name: true } }, usages: true } });
    res.status(201).json({ status: 'success', data: { ...question, reuse: questionReuseStatus(question.usages, question.category), ownership: 'owned' } });
  } catch (error) { next(error); }
};

export const updateBankQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = actorId(req);
    if (!userId) throw new BadRequestError('Authenticated identity is required.', 'ERR_AUTH_REQUIRED');
    const question = await prisma.question.findFirst({ where: { id: req.params.questionId as string, archivedAt: null } });
    if (!question) throw new NotFoundError('Question not found.', 'ERR_QUESTION_NOT_FOUND');
    assertQuestionEditable(question, userId, isAdmin(req));
    const data = validateQuestionBankPayload({ ...req.body, category: req.body.category ?? question.category });
    const updated = await prisma.question.update({ where: { id: question.id }, data, include: { owner: { select: { id: true, name: true } }, usages: { select: { category: true, assessmentTitle: true, usedAt: true, quizId: true, assignmentId: true, isFinalized: true } } } });
    res.status(200).json({ status: 'success', data: { ...updated, reuse: questionReuseStatus(updated.usages, updated.category), ownership: updated.ownerId === userId ? 'owned' : 'shared' } });
  } catch (error) { next(error); }
};

export const archiveBankQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = actorId(req);
    if (!userId) throw new BadRequestError('Authenticated identity is required.', 'ERR_AUTH_REQUIRED');
    const question = await prisma.question.findFirst({ where: { id: req.params.questionId as string, archivedAt: null } });
    if (!question) throw new NotFoundError('Question not found.', 'ERR_QUESTION_NOT_FOUND');
    assertQuestionEditable(question, userId, isAdmin(req));
    await prisma.question.update({ where: { id: question.id }, data: { archivedAt: new Date() } });
    res.status(200).json({ status: 'success', message: 'Question removed from the bank.' });
  } catch (error) { next(error); }
};

export const uploadQuestionImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new BadRequestError('Upload a PNG, JPEG or WebP image (maximum 5 MB).', 'ERR_INVALID_QUESTION_IMAGE');
    const url = await uploadToCloudinaryBuffer(req.file.buffer, req.file.mimetype);
    if (!url) throw new BadRequestError('Image upload failed. Check the image service configuration and retry.', 'ERR_QUESTION_IMAGE_UPLOAD');
    res.status(200).json({ status: 'success', data: { url } });
  } catch (error) { next(error); }
};

