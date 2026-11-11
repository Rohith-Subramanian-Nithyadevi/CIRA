const FACULTY_EMAIL_REGEX = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@ch\.amrita\.edu$/i;

export const getFacultyEmailError = (email: string): string | null => {
  const normalizedEmail = email.trim().toLowerCase();
  const localPart = normalizedEmail.split('@')[0];
  if (
    !FACULTY_EMAIL_REGEX.test(normalizedEmail) ||
    !localPart || localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')
  ) {
    return 'Use a valid faculty email ending in @ch.amrita.edu.';
  }
  return null;
};

export const normalizeFacultyEmail = (email: string): string => email.trim().toLowerCase();
