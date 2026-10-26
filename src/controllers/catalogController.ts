import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/httpError';
import { findPerfil, listPlantillas } from '../repositories/catalogRepository';
import { listAchievements } from '../services/achievementService';
import { getUserPoints } from '../services/pointService';

function requireUserId(req: Request): number {
  const id = req.user?.id;
  if (typeof id !== 'number') {
    throw new HttpError(401, 'no autenticado');
  }
  return id;
}

export async function listPlantillasHandler(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await listPlantillas());
  } catch (err) {
    next(err);
  }
}

export async function listLogrosHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await listAchievements(requireUserId(req)));
  } catch (err) {
    next(err);
  }
}

export async function getPerfilHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const usuarioId = requireUserId(req);
    const perfil = await findPerfil(usuarioId);
    if (!perfil) {
      throw new HttpError(404, 'usuario no encontrado');
    }
    res.status(200).json({ ...perfil, puntos: await getUserPoints(usuarioId) });
  } catch (err) {
    next(err);
  }
}
