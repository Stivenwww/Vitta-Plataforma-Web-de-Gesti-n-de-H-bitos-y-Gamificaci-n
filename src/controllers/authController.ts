import type { NextFunction, Request, Response } from 'express';
import { register, login } from '../services/authService';

export async function registerHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await register(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function loginHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await login(req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
