import type { NextFunction, Request, Response } from 'express';
import { config } from '../config/env';
import { HttpError } from '../utils/httpError';

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'recurso no encontrado' });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err && typeof err === 'object' && (err as { code?: string }).code === '23505') {
    res.status(409).json({ error: 'correo ya registrado' });
    return;
  }
  if (config.nodeEnv === 'development') {
    console.error('[vitta]', err);
  }
  res.status(500).json({ error: 'error interno' });
}
