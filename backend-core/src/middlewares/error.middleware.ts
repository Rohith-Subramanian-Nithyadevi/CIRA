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
  let response = {
    status: 'error',
    errorCode: 'ERR_INTERNAL_SERVER',
    message: 'An unexpected error occurred.',
    details: null as any,
  };

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    response.errorCode = err.errorCode;
    response.message = err.message;
    if ((err as any).details) {
      response.details = (err as any).details;
    }
  } else if (err instanceof ZodError) {
    statusCode = 400;
    response.errorCode = 'ERR_VALIDATION';
    response.message = 'Validation Error';
    response.details = err.issues;
  }

  // Hide detailed errors in production unless they are operational
  if (process.env.NODE_ENV === 'development') {
    response.details = response.details || err.stack;
  }

  res.status(statusCode).json(response);
};
