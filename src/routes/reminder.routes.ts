import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import {
  createReminderHandler,
  deleteReminderHandler,
  listRemindersHandler,
  updateReminderHandler,
} from '../controllers/reminderController';

export const remindersRoutes = Router();

remindersRoutes.use(authMiddleware);

remindersRoutes.get('/', listRemindersHandler);
remindersRoutes.post('/', createReminderHandler);
remindersRoutes.patch('/:id', updateReminderHandler);
remindersRoutes.delete('/:id', deleteReminderHandler);
