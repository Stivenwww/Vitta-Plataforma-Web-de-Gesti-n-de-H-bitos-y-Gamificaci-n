import type { NextFunction, Request, Response } from 'express';
import { requireUserId } from '../middleware/authMiddleware';
import {
  createReminderService,
  deleteReminderService,
  listReminders,
  updateReminderService,
} from '../services/reminderService';

export async function listRemindersHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await listReminders(requireUserId(req)));
  } catch (err) {
    next(err);
  }
}

export async function createReminderHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(201).json(await createReminderService(requireUserId(req), req.body));
  } catch (err) {
    next(err);
  }
}

export async function updateReminderHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await updateReminderService(requireUserId(req), req.params.id, req.body));
  } catch (err) {
    next(err);
  }
}

export async function deleteReminderHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await deleteReminderService(requireUserId(req), req.params.id);
    res.status(200).json({ mensaje: 'recordatorio eliminado' });
  } catch (err) {
    next(err);
  }
}
