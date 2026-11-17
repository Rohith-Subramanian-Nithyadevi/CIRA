import crypto from 'crypto';

const STEP_SECONDS = 30;

/**
 * Derives a 6-digit numeric OTP for a given quiz ID at a specific 30-second time step.
 */
export const generateQuizOtp = (
  quizId: string,
  timeStep = Math.floor(Date.now() / (STEP_SECONDS * 1000))
): string => {
  const secret = process.env.JWT_SECRET || 'cira-quiz-totp-fallback-secret';
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(`${quizId}:${timeStep}`);
  const hash = hmac.digest();
  // Dynamic truncation (RFC 6238 / RFC 4226 style)
  const offset = hash[hash.length - 1] & 0xf;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);
  const otpNumber = binary % 1000000;
  return String(otpNumber).padStart(6, '0');
};

/**
 * Returns remaining seconds in the current 30-second window.
 */
export const getOtpRemainingSeconds = (): number => {
  const elapsed = Math.floor((Date.now() / 1000) % STEP_SECONDS);
  return Math.max(1, STEP_SECONDS - elapsed);
};

/**
 * Verifies a 6-digit OTP against the current, previous, or next 30-second window (clock drift tolerance).
 */
export const verifyQuizOtp = (quizId: string, userOtp: string): boolean => {
  if (!userOtp || typeof userOtp !== 'string') return false;
  const cleanOtp = userOtp.trim();
  if (cleanOtp.length !== 6) return false;

  const currentStep = Math.floor(Date.now() / (STEP_SECONDS * 1000));
  const validSteps = [currentStep, currentStep - 1, currentStep + 1];

  return validSteps.some((step) => {
    const expected = generateQuizOtp(quizId, step);
    return crypto.timingSafeEqual(Buffer.from(cleanOtp), Buffer.from(expected));
  });
};
