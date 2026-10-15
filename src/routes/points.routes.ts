import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { getMyPointsHandler, listMyMovementsHandler } from '../controllers/pointController';

export const pointsRoutes = Router();

pointsRoutes.use(authMiddleware);

pointsRoutes.get('/me', getMyPointsHandler);
pointsRoutes.get('/me/movements', listMyMovementsHandler);
