import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { HttpError } from '../utils/httpError';
import { findTokenVersion } from '../repositories/userRepository';

declare global {
  namespace Express {
    interface Request {
      user?: { id: number; correo: string };
    }
  }
}

export interface TokenPayload {
  id: number;
  correo: string;
  /** Versión de credenciales (D-13). Tokens antiguos sin `tv` equivalen a 0. */
  tv?: number;
}

/**
 * CA-03: verifica firma y expiración del JWT y, además, que el usuario siga
 * existiendo y que el token no sea anterior a su último cambio de contraseña.
 */
export async function authMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
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
  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, config.jwtSecret) as TokenPayload;
  } catch {
    next(new HttpError(401, 'no autenticado'));
    return;
  }
  if (typeof payload.id !== 'number' || typeof payload.correo !== 'string') {
    next(new HttpError(401, 'no autenticado'));
    return;
  }
  try {
    const version = await findTokenVersion(payload.id);
    if (version === null || version !== (payload.tv ?? 0)) {
      next(new HttpError(401, 'no autenticado'));
      return;
    }
  } catch (err) {
    next(err);
    return;
  }
  req.user = { id: payload.id, correo: payload.correo };
  next();
}

export function requireUserId(req: Request): number {
  const id = req.user?.id;
  if (typeof id !== 'number') {
    throw new HttpError(401, 'no autenticado');
  }
  return id;
}
