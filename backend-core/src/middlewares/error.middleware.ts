import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { ZodError } from 'zod';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(`[Error] ${err.name}: ${err.message}`);

  // Default to 500 server error
  let statusCode = 500;
  let error = {
    code: 'ERR_INTERNAL_SERVER',
    message: 'An unexpected error occurred.',
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

  // Hide detailed errors in production unless they are operational
  if (process.env.NODE_ENV === 'development') {
    error.details = error.details || err.stack;
  }

  res.status(statusCode).json({ error });
};
