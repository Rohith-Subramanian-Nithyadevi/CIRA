import { Prisma, QuestionCategory, QuestionType } from '@prisma/client';
import { BadRequestError, ForbiddenError } from './errors';
import { normalizeStoredImageValue } from './object-storage';

const categories = Object.values(QuestionCategory);
const types = Object.values(QuestionType);

export interface QuestionBankFilters {
  category: QuestionCategory;
  includeReused: boolean;
  search?: string;
  subject?: string;
  topic?: string;
  difficulty?: string;
  type?: QuestionType;
  tag?: string;
  page: number;
  limit: number;
}

export const QUESTION_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const isAllowedQuestionImage = (mimeType: string, fileName: string) => {
  const extension = fileName.toLowerCase().split('.').pop();
  const expectedMime: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
  return Boolean(extension && expectedMime[extension] === mimeType);
};

export const parseQuestionBankFilters = (query: Record<string, unknown>): QuestionBankFilters => {
  const category = typeof query.category === 'string' ? query.category : 'TEST_QUIZ';
  const type = typeof query.type === 'string' ? query.type : undefined;
  if (!categories.includes(category as QuestionCategory)) throw new BadRequestError('Category must be ASSIGNMENT or TEST_QUIZ.', 'ERR_INVALID_QUESTION_CATEGORY');
  if (type && !types.includes(type as QuestionType)) throw new BadRequestError('Question type is invalid.', 'ERR_INVALID_QUESTION_TYPE');
  const page = Math.max(1, Number.parseInt(String(query.page || '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(query.limit || '20'), 10) || 20));
  return {
    category: category as QuestionCategory,
    includeReused: query.includeReused === 'true',
    search: typeof query.search === 'string' ? query.search.trim() : undefined,
    subject: typeof query.subject === 'string' ? query.subject.trim() : undefined,
    topic: typeof query.topic === 'string' ? query.topic.trim() : undefined,
    difficulty: typeof query.difficulty === 'string' ? query.difficulty.trim() : undefined,
    type: type as QuestionType | undefined,
    tag: typeof query.tag === 'string' ? query.tag.trim() : undefined,
    page,
    limit,
  };
};

export const buildQuestionBankWhere = (filters: QuestionBankFilters, userId: string, isAdmin = false): Prisma.QuestionWhereInput => ({
  AND: [
    { archivedAt: null },
    { category: filters.category },
    ...(isAdmin ? [] : [{ OR: [{ ownerId: userId }, { ownerId: null }, { owner: { is: { role: 'ADMIN' as const } } }] }]),
    ...(filters.search ? [{ OR: [
      { text: { contains: filters.search, mode: 'insensitive' as const } },
      { subject: { contains: filters.search, mode: 'insensitive' as const } },
      { topic: { contains: filters.search, mode: 'insensitive' as const } },
      { subtopic: { contains: filters.search, mode: 'insensitive' as const } },
      { tags: { has: filters.search } },
    ] }] : []),
    ...(filters.subject ? [{ subject: { equals: filters.subject, mode: 'insensitive' as const } }] : []),
    ...(filters.topic ? [{ OR: [
      { topic: { contains: filters.topic, mode: 'insensitive' as const } },
      { subtopic: { contains: filters.topic, mode: 'insensitive' as const } },
    ] }] : []),
    ...(filters.difficulty ? [{ difficulty: filters.difficulty }] : []),
    ...(filters.type ? [{ type: filters.type }] : []),
    ...(filters.tag ? [{ tags: { has: filters.tag } }] : []),
    ...(!filters.includeReused ? [{ usages: { none: { category: { not: filters.category }, isFinalized: true } } }] : []),
  ],
});

export const validateQuestionBankPayload = (input: any) => {
  if (!input || typeof input !== 'object') throw new BadRequestError('Question payload is required.', 'ERR_INVALID_QUESTION');
  if (!categories.includes(input.category)) throw new BadRequestError('Category must be ASSIGNMENT or TEST_QUIZ.', 'ERR_INVALID_QUESTION_CATEGORY');
  if (!types.includes(input.type)) throw new BadRequestError('Question type is invalid.', 'ERR_INVALID_QUESTION_TYPE');
  if (typeof input.text !== 'string' || !input.text.trim()) throw new BadRequestError('Question text is required.', 'ERR_INVALID_QUESTION_TEXT');
  if (!Number.isFinite(Number(input.marks)) || Number(input.marks) <= 0) throw new BadRequestError('Marks must be a positive number.', 'ERR_INVALID_QUESTION_MARKS');
  if (input.difficulty && !['Easy', 'Medium', 'Hard'].includes(input.difficulty)) throw new BadRequestError('Difficulty must be Easy, Medium or Hard.', 'ERR_INVALID_QUESTION_DIFFICULTY');
  const options = input.options;
  const answer = input.answerKey;
  const optionStrings = Array.isArray(options) && options.every((value) => typeof value === 'string') ? options.map((value) => value.trim()).filter(Boolean) : [];
  if (['MCQ', 'MULTI_SELECT'].includes(input.type) && optionStrings.length < 2) throw new BadRequestError('This question type requires at least two non-empty options.', 'ERR_INVALID_QUESTION_OPTIONS');
  if (input.type === 'MCQ' && (!optionStrings.includes(String(answer)) || optionStrings.length !== options.length)) throw new BadRequestError('Choose one of the listed options as the correct answer.', 'ERR_INVALID_QUESTION_ANSWER');
  if (input.type === 'MULTI_SELECT' && (!Array.isArray(answer) || answer.length === 0 || answer.some((value: unknown) => !optionStrings.includes(String(value))))) throw new BadRequestError('Choose one or more listed correct answers.', 'ERR_INVALID_QUESTION_ANSWER');
  if (input.type === 'TRUE_FALSE' && ![true, false, 'true', 'false'].includes(answer)) throw new BadRequestError('Choose True or False as the correct answer.', 'ERR_INVALID_QUESTION_ANSWER');
  if (input.type === 'NUMERICAL' && (answer === '' || answer === null || !Number.isFinite(Number(answer)))) throw new BadRequestError('Enter a valid numerical answer.', 'ERR_INVALID_QUESTION_ANSWER');
  if (input.type === 'FILL_BLANK' && (typeof answer !== 'string' || !answer.trim())) throw new BadRequestError('Expected answer is required.', 'ERR_INVALID_QUESTION_ANSWER');
  if (input.type === 'MATCHING' && (!Array.isArray(options) || !options.length || options.some((pair: any) => !pair?.left?.trim() || !pair?.right?.trim()))) throw new BadRequestError('Each matching pair needs a left and right value.', 'ERR_INVALID_QUESTION_OPTIONS');
  if (input.type === 'MATCHING' && (!Array.isArray(answer) || answer.length !== options.length)) throw new BadRequestError('Matching answers must correspond to each pair.', 'ERR_INVALID_QUESTION_ANSWER');
  if (input.type === 'CODING' && (typeof answer !== 'string' || !answer.trim())) throw new BadRequestError('A reference solution is required for coding questions.', 'ERR_INVALID_QUESTION_ANSWER');
  if (
    input.image != null &&
    input.image !== '' &&
    (typeof input.image !== 'string' ||
      (!/^cira-quiz-images\/[a-zA-Z0-9._-]+$/i.test(input.image.trim()) &&
        !/^https:\/\/([a-z0-9-]+\.)*neon\.tech\//i.test(input.image.trim()) &&
        !/^https:\/\/res\.cloudinary\.com\//i.test(input.image.trim())))
  ) {
    throw new BadRequestError('Question images must use the approved image upload.', 'ERR_INVALID_QUESTION_IMAGE');
  }
  const tags = Array.isArray(input.tags) ? input.tags : typeof input.tags === 'string' ? input.tags.split(',') : [];
  const normalizedOptions = Array.isArray(options)
    ? input.type === 'MATCHING'
      ? options.map((pair: any) => ({ left: String(pair.left).trim(), right: String(pair.right).trim() }))
      : options.map((option: unknown) => String(option).trim())
    : options;
  const normalizedAnswer = input.type === 'NUMERICAL'
    ? Number(answer)
    : input.type === 'TRUE_FALSE'
      ? answer === true || answer === 'true'
      : input.type === 'MCQ'
        ? String(answer).trim()
        : input.type === 'MULTI_SELECT'
          ? answer.map((value: unknown) => String(value).trim())
          : input.type === 'MATCHING'
            ? normalizedOptions
            : answer;
  return {
    category: input.category,
    type: input.type,
    text: input.text.trim(),
    subject: typeof input.subject === 'string' && input.subject.trim() ? input.subject.trim() : null,
    topic: typeof input.topic === 'string' && input.topic.trim() ? input.topic.trim() : null,
    subtopic: typeof input.subtopic === 'string' && input.subtopic.trim() ? input.subtopic.trim() : null,
    difficulty: typeof input.difficulty === 'string' && input.difficulty.trim() ? input.difficulty.trim() : null,
    tags: [...new Set<string>(tags.map((tag: unknown): string => String(tag).trim()).filter((tag: string) => Boolean(tag)))],
    marks: Number(input.marks),
    negativeMarks: Number.isFinite(Number(input.negativeMarks)) && Number(input.negativeMarks) >= 0 ? Number(input.negativeMarks) : 0,
    options: normalizedOptions ?? undefined,
    answerKey: answer === undefined ? undefined : normalizedAnswer,
    explanation: typeof input.explanation === 'string' && input.explanation.trim() ? input.explanation.trim() : null,
    image: input.image ? normalizeStoredImageValue(input.image) : null,
  };
};

export const assertQuestionEditable = (question: { ownerId: string | null }, userId: string, isAdmin = false) => {
  if (!isAdmin && question.ownerId !== userId) throw new ForbiddenError('You can only edit questions you own.', 'ERR_QUESTION_NOT_OWNED');
};

export const questionReuseStatus = (usages: Array<{ category: QuestionCategory; assessmentTitle: string; isFinalized?: boolean }>, intendedCategory: QuestionCategory) => {
  const opposite = usages.filter((usage) => usage.isFinalized !== false && usage.category !== intendedCategory);
  return { eligible: opposite.length === 0, usedInOppositeCategory: opposite.length > 0, warning: opposite.length ? 'This question has been used in the opposite assessment category.' : null };
};
