import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/httpError';
import { getHabitProgress, getProgressRange } from '../services/progressService';

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
    }, req.timeZone);
    res.status(200).json(progress);
  } catch (err) {
    next(err);
  }
}

/** GET /api/progress?desde=YYYY-MM-DD&hasta=YYYY-MM-DD */
export async function getProgressRangeHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dias = await getProgressRange(requireUserId(req), {
      desde: req.query.desde,
      hasta: req.query.hasta,
    }, req.timeZone);
    res.status(200).json(dias);
  } catch (err) {
    next(err);
  }
}
