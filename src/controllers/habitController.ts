import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/httpError';
import {
  createHabitService,
  deleteHabitService,
  getHabit,
  listHabits,
  setArchivedService,
  updateHabitService,
} from '../services/habitService';

function requireUserId(req: Request): number {
  const id = req.user?.id;
  if (typeof id !== 'number') {
    throw new HttpError(401, 'no autenticado');
  }
  return id;
}

export async function listHabitsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const habits = await listHabits(requireUserId(req), req.query.incluir_archivados);
    res.status(200).json(habits);
  } catch (err) {
    next(err);
  }
}

export async function getHabitHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const habit = await getHabit(requireUserId(req), req.params.id);
    res.status(200).json(habit);
  } catch (err) {
    next(err);
  }
}

export async function createHabitHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const habit = await createHabitService(requireUserId(req), req.body);
    res.status(201).json(habit);
  } catch (err) {
    next(err);
  }
}

export async function updateHabitHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const habit = await updateHabitService(requireUserId(req), req.params.id, req.body);
    res.status(200).json(habit);
  } catch (err) {
    next(err);
  }
}

export async function deleteHabitHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await deleteHabitService(requireUserId(req), req.params.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function archiveHabitHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await setArchivedService(requireUserId(req), req.params.id, true));
  } catch (err) {
    next(err);
  }
}

export async function restoreHabitHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await setArchivedService(requireUserId(req), req.params.id, false));
  } catch (err) {
    next(err);
  }
}
