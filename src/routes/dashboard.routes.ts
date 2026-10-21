import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { getDashboardHandler } from '../controllers/dashboardController';

export const dashboardRoutes = Router();

dashboardRoutes.use(authMiddleware);

dashboardRoutes.get('/', getDashboardHandler);
