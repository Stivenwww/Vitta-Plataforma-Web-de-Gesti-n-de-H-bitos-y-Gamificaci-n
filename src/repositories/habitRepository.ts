import { query } from '../db/pool';
import type { Habit, HabitTipo } from '../models/habit';

const SELECT_COLS =
  'id, usuario_id, nombre, meta, frecuencia, tipo, creado_en';

export async function findAllByUsuario(usuarioId: number): Promise<Habit[]> {
  const result = await query<Habit>(
    `SELECT ${SELECT_COLS} FROM habitos WHERE usuario_id = $1 ORDER BY id ASC`,
    [usuarioId],
  );
  return result.rows;
}

export async function findByIdForUsuario(
  id: number,
  usuarioId: number,
): Promise<Habit | null> {
  const result = await query<Habit>(
    `SELECT ${SELECT_COLS} FROM habitos WHERE id = $1 AND usuario_id = $2`,
    [id, usuarioId],
  );
  return result.rows[0] ?? null;
}

export async function createHabit(
  usuarioId: number,
  nombre: string,
  meta: string,
  frecuencia: string,
  tipo: HabitTipo,
): Promise<Habit> {
  const result = await query<Habit>(
    `INSERT INTO habitos (usuario_id, nombre, meta, frecuencia, tipo)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${SELECT_COLS}`,
    [usuarioId, nombre, meta, frecuencia, tipo],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('No se pudo crear el hábito');
  }
  return row;
}

export interface HabitUpdateFields {
  nombre?: string;
  meta?: string;
  frecuencia?: string;
}

export async function updateHabit(
  id: number,
  usuarioId: number,
  fields: HabitUpdateFields,
): Promise<Habit | null> {
  const result = await query<Habit>(
    `UPDATE habitos
     SET nombre = COALESCE($3, nombre),
         meta = COALESCE($4, meta),
         frecuencia = COALESCE($5, frecuencia)
     WHERE id = $1 AND usuario_id = $2
     RETURNING ${SELECT_COLS}`,
    [id, usuarioId, fields.nombre ?? null, fields.meta ?? null, fields.frecuencia ?? null],
  );
  return result.rows[0] ?? null;
}

export async function deleteHabit(id: number, usuarioId: number): Promise<boolean> {
  const result = await query(
    'DELETE FROM habitos WHERE id = $1 AND usuario_id = $2',
    [id, usuarioId],
  );
  return (result.rowCount ?? 0) > 0;
}
