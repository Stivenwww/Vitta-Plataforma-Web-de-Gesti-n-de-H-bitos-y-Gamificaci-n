import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/httpError';
import { getUserMovements, getUserPoints } from '../services/pointService';

function requireUserId(req: Request): number {
  const id = req.user?.id;
  if (typeof id !== 'number') {
    throw new HttpError(401, 'no autenticado');
  }
  return id;
}

export async function getMyPointsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const points = await getUserPoints(requireUserId(req));
    res.status(200).json(points);
  } catch (err) {
    next(err);
  }
}

export async function listMyMovementsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const movements = await getUserMovements(requireUserId(req), req.query.limit);
    res.status(200).json(movements);
  } catch (err) {
    next(err);
  }
}
