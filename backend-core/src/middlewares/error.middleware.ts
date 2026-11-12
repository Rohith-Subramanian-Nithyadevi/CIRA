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
    message: 'Something went wrong while processing your request. Please try again, and contact your administrator if the problem continues.',
    details: null as any,
  };

  // Prisma's missing-column error usually means the application is ahead of
  // the database schema. Keep the diagnosis in server logs, not the API body.
  if ((err as any).code === 'P2022') {
    error.code = 'ERR_FEATURE_UNAVAILABLE';
    error.message = 'This section is temporarily unavailable while a system update is completed. Please try again later or contact your administrator.';
  } else if ((err as any).code === 'P2025') {
    statusCode = 404;
    error.code = 'ERR_NOT_FOUND';
    error.message = 'The requested record was not found or has already been deleted.';
  } else if ((err as any).code === 'P2003') {
    statusCode = 409;
    error.code = 'ERR_CONFLICT';
    error.message = 'Cannot delete this record because related items depend on it.';
  }

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

  res.status(statusCode).json({ error });
};
