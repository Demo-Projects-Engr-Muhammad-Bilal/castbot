/**
 * Base typed application error. Thrown from services/controllers and translated
 * into the standard API envelope by `error-handler.middleware.ts`.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, statusCode = 500, details?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found.", details?: Record<string, unknown>) {
    super(message, 404, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action.", details?: Record<string, unknown>) {
    super(message, 403, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required.", details?: Record<string, unknown>) {
    super(message, 401, details);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Invalid request payload.", details?: Record<string, unknown>) {
    super(message, 400, details);
  }
}

export class PlanLimitError extends AppError {
  constructor(message = "Plan limit reached.", details?: Record<string, unknown>) {
    super(message, 403, { upgradeRequired: true, ...details });
  }
}
