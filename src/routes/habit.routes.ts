import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import {
  archiveHabitHandler,
  createHabitHandler,
  deleteHabitHandler,
  getHabitHandler,
  listHabitsHandler,
  restoreHabitHandler,
  updateHabitHandler,
} from '../controllers/habitController';

import {
  createRecordHandler,
  deleteRecordHandler,
  listRecordsHandler,
  saveProgressHandler,
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
habitRoutes.patch('/:id/progreso', saveProgressHandler);
habitRoutes.post('/:id/archive', archiveHabitHandler);
habitRoutes.post('/:id/restore', restoreHabitHandler);
habitRoutes.get('/:id/progress', getProgressHandler);
habitRoutes.get('/:id/streak', getStreakHandler);
habitRoutes.get('/:id', getHabitHandler);
habitRoutes.put('/:id', updateHabitHandler);
habitRoutes.delete('/:id', deleteHabitHandler);
