import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/httpError';
import { getStreak } from '../services/streakService';

function requireUserId(req: Request): number {
  const id = req.user?.id;
  if (typeof id !== 'number') {
    throw new HttpError(401, 'no autenticado');
  }
  return id;
}

export async function getStreakHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const streak = await getStreak(requireUserId(req), req.params.id);
    res.status(200).json(streak);
  } catch (err) {
    next(err);
  }
}
