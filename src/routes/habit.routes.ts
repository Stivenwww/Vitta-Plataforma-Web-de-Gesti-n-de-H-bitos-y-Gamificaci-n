import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import {
  createHabitHandler,
  deleteHabitHandler,
  getHabitHandler,
  listHabitsHandler,
  updateHabitHandler,
} from '../controllers/habitController';

import {
  createRecordHandler,
  deleteRecordHandler,
  listRecordsHandler,
} from '../controllers/recordController';

import { getStreakHandler } from '../controllers/streakController';
import { getProgressHandler } from '../controllers/progressController';

export const habitRoutes = Router();

habitRoutes.use(authMiddleware);

habitRoutes.get('/', listHabitsHandler);
habitRoutes.post('/', createHabitHandler);
habitRoutes.get('/:id/records', listRecordsHandler);
habitRoutes.post('/:id/records', createRecordHandler);
habitRoutes.delete('/:id/records/:registroId', deleteRecordHandler);
habitRoutes.get('/:id/progress', getProgressHandler);
habitRoutes.get('/:id/streak', getStreakHandler);
habitRoutes.get('/:id', getHabitHandler);
habitRoutes.put('/:id', updateHabitHandler);
habitRoutes.delete('/:id', deleteHabitHandler);
