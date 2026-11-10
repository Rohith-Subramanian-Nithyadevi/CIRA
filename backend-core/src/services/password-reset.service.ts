import { randomInt } from 'crypto';
import { prisma } from '../config/prisma';
import { BadRequestError } from '../utils/errors';
import { sendPasswordResetEmail } from '../utils/email';

interface ResettableUser {
  id: string;
  authProvider: string;
  password: string;
  personalEmail: string | null;
}

export const issuePasswordReset = async (user: ResettableUser) => {
  if (user.authProvider === 'GOOGLE' || user.password.includes('SSO_')) {
    throw new BadRequestError('Password reset is not available for accounts created via Google Sign-In. Please use Google Sign-In.', 'ERR_GOOGLE_AUTH_ACCOUNT');
  }
  if (!user.personalEmail) {
    throw new BadRequestError('No personal email configured for this account. Please contact an administrator.', 'ERR_NO_PERSONAL_EMAIL');
  }

  const resetCode = randomInt(100000, 1000000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await prisma.user.update({
    where: { id: user.id },
    data: { verificationCode: resetCode, verificationCodeExpiresAt: expiresAt },
  });
  await sendPasswordResetEmail(user.personalEmail, resetCode);
};
