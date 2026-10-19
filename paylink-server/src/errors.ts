export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function validationError(message: string, details?: unknown): ApiError {
  return new ApiError(400, 'VALIDATION_ERROR', message, details);
}

export function unauthorized(message = 'Authentication is required'): ApiError {
  return new ApiError(401, 'UNAUTHORIZED', message);
}

export function forbidden(message = 'You do not have access to this resource'): ApiError {
  return new ApiError(403, 'FORBIDDEN', message);
}

export function notFound(message = 'Resource not found'): ApiError {
  return new ApiError(404, 'NOT_FOUND', message);
}

export function conflict(message: string, details?: unknown): ApiError {
  return new ApiError(409, 'CONFLICT', message, details);
}

export function tooManyRequests(retryAfterSeconds: number): ApiError {
  return new ApiError(429, 'RATE_LIMITED', 'Too many requests; try again later', { retryAfterSeconds });
}
