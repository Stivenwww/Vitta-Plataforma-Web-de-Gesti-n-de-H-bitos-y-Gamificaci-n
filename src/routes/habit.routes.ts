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
  listRecordsHandler,
} from '../controllers/recordController';

import { getStreakHandler } from '../controllers/streakController';

export const habitRoutes = Router();

habitRoutes.use(authMiddleware);

habitRoutes.get('/', listHabitsHandler);
habitRoutes.post('/', createHabitHandler);
habitRoutes.get('/:id/records', listRecordsHandler);
habitRoutes.post('/:id/records', createRecordHandler);
habitRoutes.get('/:id/streak', getStreakHandler);
habitRoutes.get('/:id', getHabitHandler);
habitRoutes.put('/:id', updateHabitHandler);
habitRoutes.delete('/:id', deleteHabitHandler);
