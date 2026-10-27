import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { findByCorreo, createUser } from '../repositories/userRepository';
import { toPublicUser, type User } from '../models/user';
import { validateRegisterInput, validateLoginInput } from '../utils/validation';
import { HttpError } from '../utils/httpError';

export interface AuthRepository {
  findByCorreo: (correo: string) => Promise<User | null>;
  createUser: (nombre: string, correo: string, passwordHash: string) => Promise<User>;
}

const defaultRepository: AuthRepository = { findByCorreo, createUser };

/** `tv` = versión de credenciales: un cambio de contraseña invalida los tokens previos. */
export function signToken(user: Pick<User, 'id' | 'correo' | 'token_version'>): string {
  return jwt.sign({ id: user.id, correo: user.correo, tv: user.token_version }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export async function register(body: unknown, repo: AuthRepository = defaultRepository) {
  const input = validateRegisterInput(body);
  const existing = await repo.findByCorreo(input.correo);
  if (existing) {
    throw new HttpError(409, 'correo ya registrado');
  }
  const passwordHash = await bcrypt.hash(input.password, 10);
  try {
    const user = await repo.createUser(input.nombre, input.correo, passwordHash);
    return {
      usuario: toPublicUser(user),
      token: signToken(user),
    };
  } catch (err: unknown) {
    if (err && typeof err === 'object' && (err as { code?: string }).code === '23505') {
      throw new HttpError(409, 'correo ya registrado');
    }
    throw err;
  }
}

export async function login(body: unknown, repo: AuthRepository = defaultRepository) {
  const input = validateLoginInput(body);
  const user = await repo.findByCorreo(input.correo);
  const valid = user ? await bcrypt.compare(input.password, user.password_hash) : false;
  if (!user || !valid) {
    throw new HttpError(401, 'credenciales inválidas');
  }
  return {
    token: signToken(user),
    usuario: toPublicUser(user),
  };
}
