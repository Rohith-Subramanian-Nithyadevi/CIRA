import { BadRequestError, ForbiddenError } from './errors';

const FACULTY_EMAIL_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@ch\.amrita\.edu$/i;

export const normalizeFacultyEmail = (value: unknown): string => {
  if (typeof value !== 'string') {
    throw new BadRequestError('Faculty email must be a valid @ch.amrita.edu address.', 'ERR_FACULTY_EMAIL_DOMAIN');
  }

  const email = value.trim().toLowerCase();
  const localPart = email.split('@')[0];
  if (
    !FACULTY_EMAIL_PATTERN.test(email) ||
    !localPart || localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')
  ) {
    throw new BadRequestError('Faculty email must be a valid @ch.amrita.edu address.', 'ERR_FACULTY_EMAIL_DOMAIN');
  }

  return email;
};

export interface AuthenticatedPrincipal {
  userId?: string;
  role?: string;
}

export interface AssessmentAttemptOwner {
  userId: string;
}

export const assertStudentOwnsAttempt = (
  principal: AuthenticatedPrincipal | undefined,
  attempt: AssessmentAttemptOwner,
): void => {
  if (!principal?.userId || principal.role !== 'STUDENT') {
    throw new ForbiddenError('Only authenticated students can submit assessment attempts.', 'ERR_STUDENT_SUBMISSION_ONLY');
  }
  if (principal.userId !== attempt.userId) {
    throw new ForbiddenError('You can only submit your own exam attempt.', 'ERR_FORBIDDEN_ATTEMPT_SUBMIT');
  }
};

export interface FacultyPasswordChange {
  currentPassword: string;
  newPassword: string;
}

export const parseFacultyPasswordChange = (payload: unknown): FacultyPasswordChange => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new BadRequestError('Only password changes are permitted for faculty profiles.', 'ERR_FACULTY_PROFILE_LOCKED');
  }

  const data = payload as Record<string, unknown>;
  const allowed = new Set(['currentPassword', 'newPassword']);
  if (Object.keys(data).some((key) => !allowed.has(key))) {
    throw new BadRequestError('Faculty profile fields are read-only. Only password changes are permitted.', 'ERR_FACULTY_PROFILE_LOCKED');
  }
  if (typeof data.currentPassword !== 'string' || !data.currentPassword || typeof data.newPassword !== 'string') {
    throw new BadRequestError('Current password and new password are required.', 'ERR_PASSWORD_CHANGE_FIELDS');
  }
  if (data.newPassword.length < 8) {
    throw new BadRequestError('New password must be at least 8 characters long.', 'ERR_PASSWORD_TOO_WEAK');
  }
  if (!/[A-Z]/.test(data.newPassword) || !/[0-9]/.test(data.newPassword)) {
    throw new BadRequestError('New password must contain an uppercase letter and a number.', 'ERR_PASSWORD_TOO_WEAK');
  }

  return { currentPassword: data.currentPassword, newPassword: data.newPassword };
};
