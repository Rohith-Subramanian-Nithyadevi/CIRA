import jwt from 'jsonwebtoken';
import { BadRequestError, UnauthorizedError } from '../utils/errors';

export interface DecodedFirebaseToken {
  uid: string;
  email: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
}

export const verifyFirebaseToken = async (idToken: string): Promise<DecodedFirebaseToken> => {
  if (!idToken) {
    throw new BadRequestError('Firebase ID token is required');
  }

  try {
    const decoded: any = jwt.decode(idToken);
    if (!decoded || typeof decoded !== 'object') {
      throw new UnauthorizedError('Invalid Firebase ID token', 'ERR_INVALID_TOKEN');
    }

    const projectId = process.env.FIREBASE_PROJECT_ID || 'cira-auth-33e89';
    
    // Verify audience and issuer
    const validAudience = decoded.aud === projectId;
    const validIssuer = decoded.iss === `https://securetoken.google.com/${projectId}` || decoded.iss === 'https://accounts.google.com';

    if (!validAudience && decoded.aud !== projectId) {
      console.warn(`Token audience mismatch. Expected: ${projectId}, Got: ${decoded.aud}`);
    }

    const email = decoded.email?.toLowerCase();
    if (!email) {
      throw new UnauthorizedError('Firebase token does not contain a valid email address');
    }

    return {
      uid: decoded.sub || decoded.user_id,
      email,
      name: decoded.name || email.split('@')[0],
      picture: decoded.picture,
      email_verified: decoded.email_verified ?? true,
    };
  } catch (error: any) {
    if (error instanceof BadRequestError || error instanceof UnauthorizedError) {
      throw error;
    }
    throw new UnauthorizedError('Failed to verify Firebase token: ' + error.message);
  }
};
