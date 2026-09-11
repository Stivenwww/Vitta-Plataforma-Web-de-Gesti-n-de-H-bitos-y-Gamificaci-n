import { Router } from 'express';
import { registerHandler, loginHandler } from '../controllers/authController';

export const authRoutes = Router();

authRoutes.post('/register', registerHandler);
authRoutes.post('/login', loginHandler);
