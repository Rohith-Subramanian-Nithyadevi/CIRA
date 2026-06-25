export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public errorCode: string;

  constructor(message: string, statusCode: number, errorCode: string) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = 'Bad Request', errorCode: string = 'ERR_BAD_REQUEST') {
    super(message, 400, errorCode);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized', errorCode: string = 'ERR_UNAUTHORIZED') {
    super(message, 401, errorCode);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden', errorCode: string = 'ERR_FORBIDDEN') {
    super(message, 403, errorCode);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Not Found', errorCode: string = 'ERR_NOT_FOUND') {
    super(message, 404, errorCode);
  }
}

export class ValidationError extends AppError {
  public details: any;

  constructor(message: string = 'Validation Error', details: any = null, errorCode: string = 'ERR_VALIDATION') {
    super(message, 400, errorCode);
    this.details = details;
  }
}
