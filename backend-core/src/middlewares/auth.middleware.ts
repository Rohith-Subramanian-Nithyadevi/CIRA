import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';

// Extend Express Request object to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: string;
      };
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or invalid Authorization header', 'ERR_AUTH_MISSING'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    next(error);
  }
};

export const authorize = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError('User not authenticated', 'ERR_NOT_AUTHENTICATED'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError('Insufficient permissions', 'ERR_FORBIDDEN'));
    }

    next();
  };
};
