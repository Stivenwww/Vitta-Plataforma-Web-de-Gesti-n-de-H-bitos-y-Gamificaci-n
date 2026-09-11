import dotenv from 'dotenv';

dotenv.config();

function readPort(): number {
  const raw = process.env.PORT ?? '3000';
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('La variable de entorno PORT debe ser un entero positivo');
  }
  return port;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';

let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  if (nodeEnv === 'production') {
    throw new Error('Falta la variable de entorno JWT_SECRET');
  }
  jwtSecret = 'dev-secret-solo-para-desarrollo';
  console.warn('[vitta] JWT_SECRET no definido; usando secreto temporal de desarrollo.');
}

export const config = {
  nodeEnv,
  port: readPort(),
  databaseUrl: process.env.DATABASE_URL ?? '',
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
};
