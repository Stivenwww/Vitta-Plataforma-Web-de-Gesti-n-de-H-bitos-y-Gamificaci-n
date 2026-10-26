import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/httpError';
import { DEFAULT_TIME_ZONE, isSupportedTimeZone } from '../utils/timezone';

declare global {
  namespace Express {
    interface Request {
      /** Zona IANA validada del encabezado `X-Timezone`, o America/Bogota. */
      timeZone: string;
    }
  }
}

export function timezoneMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const raw = req.headers['x-timezone'];
  if (raw === undefined || raw === '') {
    req.timeZone = DEFAULT_TIME_ZONE;
    next();
    return;
  }
  const tz = Array.isArray(raw) ? raw[0] : raw.trim();
  if (!isSupportedTimeZone(tz)) {
    next(new HttpError(400, 'X-Timezone inválido: use un nombre IANA, p. ej. America/Bogota'));
    return;
  }
  req.timeZone = tz;
  next();
}
