import express from 'express';
import { authRoutes } from './routes/auth.routes';
import { habitRoutes } from './routes/habit.routes';
import { pointsRoutes } from './routes/points.routes';
import { logrosRoutes, plantillasRoutes, usersRoutes } from './routes/catalog.routes';
import { dashboardRoutes } from './routes/dashboard.routes';
import { progressRoutes } from './routes/progress.routes';
import { remindersRoutes } from './routes/reminder.routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { timezoneMiddleware } from './middleware/timezoneMiddleware';

export const app = express();

app.use(express.json({ limit: '100kb' }));
app.use(timezoneMiddleware);

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.use('/api/auth', authRoutes);
app.use('/api/habits', habitRoutes);
app.use('/api/points', pointsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/plantillas', plantillasRoutes);
app.use('/api/logros', logrosRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/recordatorios', remindersRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
