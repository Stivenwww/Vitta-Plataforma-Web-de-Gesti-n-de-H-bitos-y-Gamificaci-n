import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { getPerfilHandler, listLogrosHandler, listPlantillasHandler } from '../controllers/catalogController';

export const plantillasRoutes = Router();
plantillasRoutes.use(authMiddleware);
plantillasRoutes.get('/', listPlantillasHandler);

export const logrosRoutes = Router();
logrosRoutes.use(authMiddleware);
logrosRoutes.get('/', listLogrosHandler);

export const usersRoutes = Router();
usersRoutes.use(authMiddleware);
usersRoutes.get('/me', getPerfilHandler);
