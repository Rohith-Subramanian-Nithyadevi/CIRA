import { Request, Response, NextFunction } from 'express';
import { getFacultyScope, FacultyScope } from '../services/faculty-scope.service';
import { UnauthorizedError } from '../utils/errors';

declare global {
  namespace Express {
    interface Request {
      facultyScope?: FacultyScope;
    }
  }
}

export const createAttachFacultyScope = (
  resolveScope: typeof getFacultyScope = getFacultyScope,
) => async (req: Request, _res: Response, next: NextFunction) => {
  try {
    if (req.user?.role !== 'FACULTY') return next();
    if (!req.user.userId) throw new UnauthorizedError('Faculty identity is missing from the authentication token.');
    req.facultyScope = await resolveScope(req.user.userId);
    next();
  } catch (error) {
    next(error);
  }
};

export const attachFacultyScope = createAttachFacultyScope();
