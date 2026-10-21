import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/httpError';
import { getDashboard } from '../services/dashboardService';

function requireUserId(req: Request): number {
  const id = req.user?.id;
  if (typeof id !== 'number') {
    throw new HttpError(401, 'no autenticado');
  }
  return id;
}

export async function getDashboardHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dashboard = await getDashboard(requireUserId(req), {
      fecha: req.query.fecha,
      semanas: req.query.semanas,
    });
    res.status(200).json(dashboard);
  } catch (err) {
    next(err);
  }
}
