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
// En producción el secreto tiene que ser largo (el de .env.example no sirve).
if (jwtSecret && nodeEnv === 'production' && jwtSecret.length < 32) {
  throw new Error('JWT_SECRET es muy corto: usa al menos 32 caracteres');
}
if (!jwtSecret) {
  if (nodeEnv === 'production') {
    throw new Error('Falta la variable de entorno JWT_SECRET');
  }
  jwtSecret = 'dev-secret-solo-para-desarrollo';
  console.warn('[vitta] JWT_SECRET no definido; usando secreto temporal de desarrollo.');
}

// En producción no se arranca sin base de datos (en desarrollo pg puede usar PGHOST, etc.).
const databaseUrl = process.env.DATABASE_URL ?? '';
if (!databaseUrl && nodeEnv === 'production') {
  throw new Error('Falta la variable de entorno DATABASE_URL');
}

export const config = {
  nodeEnv,
  port: readPort(),
  databaseUrl,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
};
