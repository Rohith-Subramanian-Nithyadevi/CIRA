import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';

type TargetType = 'BATCH' | 'DEPARTMENT' | 'SECTION';
const userId = (req: Request) => req.user?.userId;
const admin = (req: Request) => req.user?.role === 'ADMIN';

export const validatePollInput = (body: any) => {
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (question.length < 3 || question.length > 500) throw new BadRequestError('Poll question must be between 3 and 500 characters.', 'ERR_POLL_QUESTION');
  if (!Array.isArray(body.options) || body.options.length < 2 || body.options.length > 10) throw new BadRequestError('A poll needs between 2 and 10 options.', 'ERR_POLL_OPTIONS');
  const options = body.options.map((option: unknown) => typeof option === 'string' ? option.trim() : '');
  if (options.some((option: string) => option.length < 1 || option.length > 160)) throw new BadRequestError('Each option must be between 1 and 160 characters.', 'ERR_POLL_OPTION');
  if (new Set(options.map((option: string) => option.toLocaleLowerCase())).size !== options.length) throw new BadRequestError('Poll options must be unique.', 'ERR_POLL_DUPLICATE_OPTION');
  const startsAt = body.startsAt ? new Date(body.startsAt) : new Date();
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  if (!Number.isFinite(startsAt.getTime()) || (expiresAt && !Number.isFinite(expiresAt.getTime()))) throw new BadRequestError('Poll dates must be valid.', 'ERR_POLL_DATE');
  if (expiresAt && expiresAt <= startsAt) throw new BadRequestError('Poll expiry must be after its start time.', 'ERR_POLL_DATE_RANGE');
  const targetType = body.targetType as TargetType;
  if (!['BATCH', 'DEPARTMENT', 'SECTION'].includes(targetType)) throw new BadRequestError('Select a batch, department or section audience.', 'ERR_POLL_TARGET');
  if (typeof body.targetId !== 'string' || !body.targetId.trim()) throw new BadRequestError('Choose a target audience.', 'ERR_POLL_TARGET');
  return { question, options, startsAt, expiresAt, targetType, targetId: body.targetId };
};

const assertPollTarget = async (req: Request, type: TargetType, targetId: string) => {
  const scope = req.facultyScope;
  if (!admin(req) && !scope) throw new ForbiddenError('Faculty class scope is unavailable.', 'ERR_POLL_SCOPE');
  if (type === 'BATCH') {
    const batch = await prisma.batch.findUnique({ where: { id: targetId }, include: { departments: { select: { id: true } } } });
    if (!batch) throw new NotFoundError('Poll batch was not found.', 'ERR_POLL_TARGET_NOT_FOUND');
    if (!admin(req) && (batch.departments.length === 0 || batch.departments.some((department) => !scope!.departmentIds.includes(department.id)))) throw new ForbiddenError('You must be assigned to every department in a batch to target the whole batch.', 'ERR_POLL_TARGET_FORBIDDEN');
    return { audience: batch.name };
  }
  if (type === 'DEPARTMENT') {
    const department = await prisma.department.findUnique({ where: { id: targetId }, include: { batch: { select: { name: true } } } });
    if (!department) throw new NotFoundError('Poll department was not found.', 'ERR_POLL_TARGET_NOT_FOUND');
    if (!admin(req) && !scope!.departmentIds.includes(department.id)) throw new ForbiddenError('You are not assigned to this department.', 'ERR_POLL_TARGET_FORBIDDEN');
    return { audience: `${department.batch.name} | ${department.name}` };
  }
  const section = await prisma.section.findUnique({ where: { id: targetId }, include: { department: { include: { batch: { select: { name: true } } } } } });
  if (!section) throw new NotFoundError('Poll section was not found.', 'ERR_POLL_TARGET_NOT_FOUND');
  if (!admin(req) && !scope!.sectionIds.includes(section.id) && !scope!.departmentIds.includes(section.departmentId)) throw new ForbiddenError('You are not assigned to this section.', 'ERR_POLL_TARGET_FORBIDDEN');
  return { audience: `${section.department.batch.name} | ${section.department.name} | Section ${section.name}` };
};

export const getPollTargets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scope = req.facultyScope;
    const [departments, sections] = await Promise.all([
      prisma.department.findMany({ where: admin(req) ? {} : { id: { in: scope?.departmentIds || [] } }, include: { batch: true }, orderBy: { name: 'asc' } }),
      prisma.section.findMany({ where: admin(req) ? {} : { OR: [{ id: { in: scope?.sectionIds || [] } }, { departmentId: { in: scope?.departmentIds || [] } }] }, include: { department: { include: { batch: true } } }, orderBy: { name: 'asc' } }),
    ]);
    const departmentIds = new Set(departments.map((item) => item.id));
    const batches = await prisma.batch.findMany({ include: { departments: { select: { id: true } } }, orderBy: { name: 'asc' } });
    const allowedBatches = batches.filter((batch) => (admin(req) || (batch.departments.length > 0 && batch.departments.every((department) => departmentIds.has(department.id)))));
    res.json({ success: true, data: { batches: allowedBatches.map(({ id, name }) => ({ id, name })), departments: departments.map(({ id, name, batch }) => ({ id, name, batch: batch.name })), sections: sections.map(({ id, name, department }) => ({ id, name, department: department.name, batch: department.batch.name })) } });
  } catch (error) { next(error); }
};

export const createPoll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const facultyId = userId(req);
    if (!facultyId) throw new ForbiddenError('Authenticated faculty identity is required.', 'ERR_POLL_AUTH');
    const input = validatePollInput(req.body);
    const { audience } = await assertPollTarget(req, input.targetType, input.targetId);
    const poll = await prisma.announcement.create({ data: {
      title: input.question, content: input.question, isSurvey: true, isPoll: true, pollOptions: input.options,
      pollStartsAt: input.startsAt, pollExpiresAt: input.expiresAt, pollAudienceType: input.targetType, pollTargetId: input.targetId,
      audience, date: input.startsAt, facultyId,
    }, include: { _count: { select: { responses: true } } } });
    res.status(201).json({ success: true, data: poll });
  } catch (error) { next(error); }
};

const pollStatusWhere = (status: string, now: Date) => status === 'ACTIVE'
  ? { pollStartsAt: { lte: now }, OR: [{ pollExpiresAt: null }, { pollExpiresAt: { gte: now } }] }
  : status === 'PUBLISHED' ? { pollStartsAt: { gt: now } }
    : status === 'CLOSED' ? { pollExpiresAt: { lt: now } } : {};

export const listPolls = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : 'ALL';
    if (!['ALL', 'PUBLISHED', 'ACTIVE', 'CLOSED'].includes(status)) throw new BadRequestError('Poll filter is invalid.', 'ERR_POLL_STATUS');
    const polls = await prisma.announcement.findMany({ where: { isPoll: true, ...(admin(req) ? {} : { facultyId: userId(req) }), ...pollStatusWhere(status, new Date()) }, include: { _count: { select: { responses: true } } }, orderBy: { pollStartsAt: 'desc' } });
    res.json({ success: true, data: polls });
  } catch (error) { next(error); }
};

export const getPollResults = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pollId = req.params.id as string;
    const poll = await prisma.announcement.findFirst({ where: { id: pollId, isPoll: true, ...(admin(req) ? {} : { facultyId: userId(req) }) } });
    if (!poll) throw new NotFoundError('Poll was not found.', 'ERR_POLL_NOT_FOUND');
    const responses = await prisma.announcementResponse.findMany({ where: { announcementId: poll.id }, select: { response: true } });
    const counts = new Map<string, number>(poll.pollOptions.map((option) => [option, 0]));
    responses.forEach(({ response }) => { if (counts.has(response)) counts.set(response, counts.get(response)! + 1); });
    const total = responses.length;
    res.json({ success: true, data: { poll, total, options: [...counts].map(([option, count]) => ({ option, count, percentage: total ? Math.round((count / total) * 1000) / 10 : null })) } });
  } catch (error) { next(error); }
};
