import { query } from '../db/pool';
import type { User } from '../models/user';

export async function findByCorreo(correo: string): Promise<User | null> {
  const result = await query<User>(
    'SELECT id, nombre, correo, password_hash, creado_en FROM usuarios WHERE correo = $1',
    [correo],
  );
  return result.rows[0] ?? null;
}

export async function createUser(
  nombre: string,
  correo: string,
  passwordHash: string,
): Promise<User> {
  const result = await query<User>(
    `INSERT INTO usuarios (nombre, correo, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, nombre, correo, password_hash, creado_en`,
    [nombre, correo, passwordHash],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('No se pudo crear el usuario');
  }
  return row;
}
