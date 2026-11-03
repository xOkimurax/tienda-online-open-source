import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '@/lib/asyncHandler';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Datos inválidos', details: err.flatten() });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...(err.details !== undefined ? { details: err.details } : {}) });
  }
  console.error(err);
  return res.status(500).json({ error: 'Error interno del servidor' });
}
