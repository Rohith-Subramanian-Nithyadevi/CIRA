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
 * Verifies a 6-digit OTP strictly against the active 30-second window.
 * Allows at most a 3-second overlap at window boundaries for network latency / clock drift.
 */
export const verifyQuizOtp = (quizId: string, userOtp: string): boolean => {
  if (!userOtp || typeof userOtp !== 'string') return false;
  const cleanOtp = userOtp.replace(/\s+/g, '').trim();
  if (cleanOtp.length !== 6) return false;

  const now = Date.now();
  const currentStep = Math.floor(now / (STEP_SECONDS * 1000));
  const elapsedInStep = (now / 1000) % STEP_SECONDS;

  // Strict 30-second validity:
  // Always allow the current time step.
  // Only allow step - 1 if within the first 3 seconds of the new step (boundary tolerance).
  // Only allow step + 1 if within the last 3 seconds of the current step.
  const validSteps = [currentStep];
  if (elapsedInStep <= 3) {
    validSteps.push(currentStep - 1);
  } else if (elapsedInStep >= STEP_SECONDS - 3) {
    validSteps.push(currentStep + 1);
  }

  return validSteps.some((step) => {
    const expected = generateQuizOtp(quizId, step);
    return crypto.timingSafeEqual(Buffer.from(cleanOtp), Buffer.from(expected));
  });
};
