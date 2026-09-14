import * as admin from 'firebase-admin';
import { BadRequestError, UnauthorizedError } from '../utils/errors';

export interface DecodedFirebaseToken {
  uid: string;
  email: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
}

const projectId = process.env.FIREBASE_PROJECT_ID || 'cira-auth-33e89';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId,
  });
}

export const verifyFirebaseToken = async (idToken: string): Promise<DecodedFirebaseToken> => {
  if (!idToken) {
    throw new BadRequestError('Firebase ID token is required');
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    
    const email = decoded.email?.toLowerCase();
    if (!email) {
      throw new UnauthorizedError('Firebase token does not contain a valid email address');
    }

    return {
      uid: decoded.uid || decoded.sub,
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
