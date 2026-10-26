import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/httpError';

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'recurso no encontrado' });
}

// Mensajes por restricción única; nunca se expone el detalle de PostgreSQL.
const UNIQUE_MESSAGES: Record<string, string> = {
  usuarios_correo_key: 'correo ya registrado',
  uq_usuarios_correo_lower: 'correo ya registrado',
  uq_registros_habito_dia: 'ya existe registro para esta fecha',
  uq_recordatorios_habito_hora: 'ya existe un recordatorio para ese hábito a esa hora',
};

interface PgLikeError {
  code?: string;
  constraint?: string;
  type?: string;
  status?: number;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  const e = (err && typeof err === 'object' ? err : {}) as PgLikeError;
  // Cuerpo JSON mal formado o demasiado grande (express.json).
  if (e.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'JSON inválido' });
    return;
  }
  if (e.type === 'entity.too.large') {
    res.status(413).json({ error: 'cuerpo demasiado grande' });
    return;
  }
  if (e.code === '23505') {
    res.status(409).json({ error: UNIQUE_MESSAGES[e.constraint ?? ''] ?? 'conflicto: el recurso ya existe' });
    return;
  }
  if (e.code === '23503' || e.code === '23001') {
    res.status(409).json({ error: 'conflicto: el recurso está en uso' });
    return;
  }
  if (e.code === '22P02' || e.code === '22003' || e.code === '22007' || e.code === '22008') {
    res.status(400).json({ error: 'datos inválidos' });
    return;
  }
  // Se registra siempre en el servidor (antes solo en desarrollo); al
  // cliente solo le llega un mensaje genérico, sin stack ni SQL.
  console.error('[vitta]', err);
  res.status(500).json({ error: 'error interno' });
}
