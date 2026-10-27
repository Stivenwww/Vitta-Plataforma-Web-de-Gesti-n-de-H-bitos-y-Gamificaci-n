import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { getProgressRangeHandler } from '../controllers/progressController';

export const progressRoutes = Router();

progressRoutes.use(authMiddleware);

progressRoutes.get('/', getProgressRangeHandler);
