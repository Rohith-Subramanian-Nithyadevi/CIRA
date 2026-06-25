import jwt from 'jsonwebtoken';
import { UnauthorizedError } from './errors';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_for_development';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

export interface JwtPayload {
  userId: string;
  role: string;
}

export const generateToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as any,
  });
};

export const verifyToken = (token: string): JwtPayload => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired token', 'ERR_INVALID_TOKEN');
  }
};
