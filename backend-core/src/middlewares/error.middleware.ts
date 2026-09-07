import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { ZodError } from 'zod';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(`[Error] ${err.name}: ${err.message}`, err.stack || '');

  // Default to 500 server error
  let statusCode = 500;
  let error = {
    code: 'ERR_INTERNAL_SERVER',
    message: err.message || 'An unexpected error occurred.',
    details: null as any,
  };

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    error.code = err.errorCode;
    error.message = err.message;
    if ((err as any).details) {
      error.details = (err as any).details;
    }
  } else if (err instanceof ZodError) {
    statusCode = 400;
    error.code = 'ERR_VALIDATION';
    error.message = 'Validation Error';
    error.details = err.issues;
  }

  // Include detailed stack/message when not explicitly in production
  if (process.env.NODE_ENV !== 'production') {
    error.details = error.details || err.stack || err.message;
  }

  res.status(statusCode).json({ error });
};
