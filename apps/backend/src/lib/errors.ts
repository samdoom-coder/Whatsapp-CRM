import type { Request, Response, NextFunction } from 'express';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, message: string, code = 'ERROR', details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(msg = 'Invalid request', details?: unknown) {
    return new ApiError(400, msg, 'BAD_REQUEST', details);
  }
  static unauthorized(msg = 'Authentication required') {
    return new ApiError(401, msg, 'UNAUTHORIZED');
  }
  static forbidden(msg = 'You do not have permission to perform this action') {
    return new ApiError(403, msg, 'FORBIDDEN');
  }
  static notFound(msg = 'Resource not found') {
    return new ApiError(404, msg, 'NOT_FOUND');
  }
  static conflict(msg = 'Resource already exists') {
    return new ApiError(409, msg, 'CONFLICT');
  }
  static tooMany(msg = 'Too many requests, please slow down') {
    return new ApiError(429, msg, 'RATE_LIMITED');
  }
  static internal(msg = 'Something went wrong') {
    return new ApiError(500, msg, 'INTERNAL_ERROR');
  }
}

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  // Prisma known errors
  const anyErr = err as { code?: string; meta?: { target?: string[] } };
  if (anyErr?.code === 'P2002') {
    const field = anyErr.meta?.target?.[0];
    return res.status(409).json({
      error: { code: 'CONFLICT', message: `${field ?? 'Record'} already exists` },
    });
  }
  if (anyErr?.code === 'P2025') {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Resource not found' },
    });
  }

  if (err instanceof SyntaxError) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid JSON payload' } });
  }

  // Zod errors are handled in validate middleware, but catch any that slip
  if (typeof err === 'object' && err !== null && 'issues' in err) {
    const issues = (err as { issues: Array<{ path: string[]; message: string }> }).issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: issues } });
  }

  const message = err instanceof Error ? err.message : 'Something went wrong';
  if (process.env.NODE_ENV !== 'test') {
    console.error('[unhandled]', err);
  }
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message } });
};