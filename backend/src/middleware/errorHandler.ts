import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { isDevelopment } from '../config/env';

interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  code?: string;
}

// Custom error class for operational errors
export class OperationalError extends Error implements AppError {
  statusCode: number;
  isOperational: boolean;
  code?: string;

  constructor(message: string, statusCode: number = 500, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Map of error codes to user-friendly messages
const errorMessages: Record<string, string> = {
  'INVALID_CREDENTIALS': 'Invalid email or password',
  'TOKEN_EXPIRED': 'Your session has expired. Please log in again',
  'TOKEN_INVALID': 'Invalid authentication token',
  'UNAUTHORIZED': 'You are not authorized to perform this action',
  'FILE_TOO_LARGE': 'File size exceeds the maximum allowed limit',
  'INVALID_FILE_TYPE': 'Invalid file type. Please upload a valid file',
  'RATE_LIMIT_EXCEEDED': 'Too many requests. Please try again later',
  'VALIDATION_ERROR': 'Invalid input data',
  'NOT_FOUND': 'The requested resource was not found',
  'SERVER_ERROR': 'An unexpected error occurred. Please try again later',
  'DATABASE_ERROR': 'A database error occurred. Please try again later',
  'EXTERNAL_SERVICE_ERROR': 'External service is temporarily unavailable',
};

// Sanitize error messages to prevent information leakage
function sanitizeErrorMessage(error: AppError): string {
  // Use error code if available
  if (error.code && errorMessages[error.code]) {
    return errorMessages[error.code];
  }

  // Common error patterns
  if (error.message.includes('duplicate key')) {
    return 'This resource already exists';
  }

  if (error.message.includes('validation failed')) {
    return 'Invalid input data';
  }

  if (error.message.includes('connection') || error.message.includes('timeout')) {
    return 'Service temporarily unavailable. Please try again later';
  }

  if (error.message.includes('not found')) {
    return 'The requested resource was not found';
  }

  // For operational errors, return the message if it's safe
  if (error.isOperational && !containsSensitiveInfo(error.message)) {
    return error.message;
  }

  // Default generic message
  return 'An unexpected error occurred';
}

// Check if error message contains sensitive information
function containsSensitiveInfo(message: string): boolean {
  const sensitivePatterns = [
    /api[_-]?key/i,
    /password/i,
    /token/i,
    /secret/i,
    /database/i,
    /connection string/i,
    /mongodb:\/\//i,
    /postgresql:\/\//i,
    /mysql:\/\//i,
    /convex:\/\//i,
    /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/, // IP addresses
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // Email addresses
  ];

  return sensitivePatterns.some(pattern => pattern.test(message));
}

// Global error handler middleware
export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log the full error internally
  logger.error('Error occurred:', {
    error: {
      message: err.message,
      stack: err.stack,
      code: err.code,
      statusCode: err.statusCode,
    },
    request: {
      method: req.method,
      url: req.url,
      headers: {
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type'],
      },
      // Don't log body as it might contain sensitive data
    },
  });

  // Determine status code
  const statusCode = err.statusCode || 500;

  // Prepare error response
  const errorResponse: any = {
    success: false,
    error: sanitizeErrorMessage(err),
  };

  // Add error code if available
  if (err.code) {
    errorResponse.code = err.code;
  }

  // In development, add more details (but still sanitized)
  if (isDevelopment && !containsSensitiveInfo(err.message)) {
    errorResponse.details = {
      message: err.message,
      // Never include stack trace in response, even in development
    };
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
}

// Async error wrapper
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// 404 handler
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: 'The requested endpoint does not exist',
    code: 'NOT_FOUND',
  });
}

// Validation error formatter
export function formatValidationError(errors: any[]): OperationalError {
  const messages = errors.map(err => {
    if (err.param) {
      return `Invalid value for ${err.param}`;
    }
    return err.msg || 'Validation failed';
  });

  return new OperationalError(
    messages.join('. '),
    400,
    'VALIDATION_ERROR'
  );
}
