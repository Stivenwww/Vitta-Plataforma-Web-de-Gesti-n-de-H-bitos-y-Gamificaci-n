import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { HttpError } from '../utils/httpError';

declare global {
  namespace Express {
    interface Request {
      user?: { id: number; correo: string };
    }
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next(new HttpError(401, 'no autenticado'));
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    next(new HttpError(401, 'no autenticado'));
    return;
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret) as { id: number; correo: string };
    if (typeof payload.id !== 'number' || typeof payload.correo !== 'string') {
      next(new HttpError(401, 'no autenticado'));
      return;
    }
    req.user = { id: payload.id, correo: payload.correo };
    next();
  } catch {
    next(new HttpError(401, 'no autenticado'));
  }
}
