import { query, type Queryable } from '../db/pool';
import type { User } from '../models/user';

const SELECT_COLS = 'id, nombre, correo, password_hash, creado_en, token_version';

/** El correo se compara sin distinguir mayúsculas (índice uq_usuarios_correo_lower). */
export async function findByCorreo(correo: string): Promise<User | null> {
  const result = await query<User>(
    `SELECT ${SELECT_COLS} FROM usuarios WHERE lower(correo) = lower($1)`,
    [correo],
  );
  return result.rows[0] ?? null;
}

export async function findById(id: number): Promise<User | null> {
  const result = await query<User>(`SELECT ${SELECT_COLS} FROM usuarios WHERE id = $1`, [id]);
  return result.rows[0] ?? null;
}

/**
 * Bloquea la fila del usuario hasta el fin de la transacción: serializa las
 * escrituras de registros, rachas, puntos y logros de un mismo usuario.
 */
export async function lockUser(id: number, db: Queryable): Promise<boolean> {
  const result = await db.query('SELECT id FROM usuarios WHERE id = $1 FOR UPDATE', [id]);
  return result.rows.length > 0;
}

export async function findTokenVersion(id: number): Promise<number | null> {
  const result = await query<{ token_version: number }>(
    'SELECT token_version FROM usuarios WHERE id = $1',
    [id],
  );
  return result.rows[0]?.token_version ?? null;
}

export async function createUser(
  nombre: string,
  correo: string,
  passwordHash: string,
): Promise<User> {
  const result = await query<User>(
    `INSERT INTO usuarios (nombre, correo, password_hash)
     VALUES ($1, $2, $3)
     RETURNING ${SELECT_COLS}`,
    [nombre, correo, passwordHash],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('No se pudo crear el usuario');
  }
  return row;
}

export async function updateProfile(
  id: number,
  fields: { nombre?: string; correo?: string },
): Promise<User | null> {
  const result = await query<User>(
    `UPDATE usuarios
        SET nombre = COALESCE($2, nombre),
            correo = COALESCE($3, correo)
      WHERE id = $1
      RETURNING ${SELECT_COLS}`,
    [id, fields.nombre ?? null, fields.correo ?? null],
  );
  return result.rows[0] ?? null;
}

/** Guarda el nuevo hash e invalida los tokens anteriores (token_version + 1). */
export async function updatePassword(id: number, passwordHash: string): Promise<User | null> {
  const result = await query<User>(
    `UPDATE usuarios
        SET password_hash = $2,
            token_version = token_version + 1
      WHERE id = $1
      RETURNING ${SELECT_COLS}`,
    [id, passwordHash],
  );
  return result.rows[0] ?? null;
}
