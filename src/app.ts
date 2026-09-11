import express from 'express';
import { authRoutes } from './routes/auth.routes';
import { habitRoutes } from './routes/habit.routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

export const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.use('/api/auth', authRoutes);
app.use('/api/habits', habitRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
