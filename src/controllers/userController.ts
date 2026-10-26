import type { NextFunction, Request, Response } from 'express';
import { requireUserId } from '../middleware/authMiddleware';
import { changePasswordService, updateProfileService } from '../services/userService';

export async function updateProfileHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await updateProfileService(requireUserId(req), req.body));
  } catch (err) {
    next(err);
  }
}

export async function changePasswordHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await changePasswordService(requireUserId(req), req.body));
  } catch (err) {
    next(err);
  }
}
