import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/httpError';
import { getHabitProgress } from '../services/progressService';

function requireUserId(req: Request): number {
  const id = req.user?.id;
  if (typeof id !== 'number') {
    throw new HttpError(401, 'no autenticado');
  }
  return id;
}

export async function getProgressHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const progress = await getHabitProgress(requireUserId(req), req.params.id, {
      periodo: req.query.periodo,
      fecha: req.query.fecha,
    });
    res.status(200).json(progress);
  } catch (err) {
    next(err);
  }
}
