import { Prisma, QuestionCategory } from '@prisma/client';
import { BadRequestError } from './errors';

export const MAX_PAPER_QUESTIONS = 100;
export const MAX_QUESTION_MARKS = 1000;
export const MAX_PAPER_MARKS = 10000;

export interface PaperQuestionInput { questionId: string; marks: number; }

export const parsePaperQuestions = (value: unknown, allowEmpty = false): PaperQuestionInput[] => {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) throw new BadRequestError('Select at least one question for the paper.', 'ERR_PAPER_QUESTIONS_REQUIRED');
  if (value.length > MAX_PAPER_QUESTIONS) throw new BadRequestError(`A paper cannot contain more than ${MAX_PAPER_QUESTIONS} questions.`, 'ERR_PAPER_TOO_MANY_QUESTIONS');
  const ids = new Set<string>();
  const questions = value.map((item: any) => {
    if (!item || typeof item.questionId !== 'string' || !item.questionId.trim()) throw new BadRequestError('Every paper question needs a valid bank question ID.', 'ERR_INVALID_PAPER_QUESTION');
    if (ids.has(item.questionId)) throw new BadRequestError('A question cannot appear twice in the same paper.', 'ERR_DUPLICATE_PAPER_QUESTION');
    ids.add(item.questionId);
    const marks = Number(item.marks);
    if (!Number.isFinite(marks) || marks <= 0 || marks > MAX_QUESTION_MARKS || Math.round(marks * 100) !== marks * 100) {
      throw new BadRequestError(`Question marks must be greater than 0 and at most ${MAX_QUESTION_MARKS}, with no more than two decimal places.`, 'ERR_INVALID_PAPER_MARKS');
    }
    return { questionId: item.questionId, marks };
  });
  const total = questions.reduce((sum, question) => sum + question.marks, 0);
  if (total > MAX_PAPER_MARKS) throw new BadRequestError(`Paper total cannot exceed ${MAX_PAPER_MARKS} marks.`, 'ERR_PAPER_TOTAL_TOO_LARGE');
  return questions;
};

export const buildPaperQuestionPoolWhere = (
  category: QuestionCategory,
  actorId: string,
  options: { includeReused: boolean; subject?: string; topic?: string; difficulty?: string; isAdmin?: boolean },
): Prisma.QuestionWhereInput => ({
  AND: [
    { archivedAt: null },
    ...(options.isAdmin ? [] : [{ OR: [{ ownerId: actorId }, { ownerId: null }, { owner: { is: { role: 'ADMIN' as const } } }] }]),
    ...(!options.includeReused ? [
      { category },
      { usages: { none: { category: { not: category }, isFinalized: true } } },
    ] : []),
    ...(options.subject ? [{ subject: { equals: options.subject, mode: 'insensitive' as const } }] : []),
    ...(options.topic ? [{ OR: [
      { topic: { contains: options.topic, mode: 'insensitive' as const } },
      { subtopic: { contains: options.topic, mode: 'insensitive' as const } },
    ] }] : []),
    ...(options.difficulty ? [{ difficulty: options.difficulty }] : []),
  ],
});

export const hasOppositeCategoryReuse = (
  question: { category: QuestionCategory; usages: Array<{ category: QuestionCategory; isFinalized: boolean }> },
  intendedCategory: QuestionCategory,
) => question.category !== intendedCategory || question.usages.some((usage) => usage.isFinalized && usage.category !== intendedCategory);

export const shuffleQuestions = <T>(items: T[], random = Math.random): T[] => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
};
