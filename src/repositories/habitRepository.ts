import { pool, query, type Queryable } from '../db/pool';
import type { Habit, HabitTipo } from '../models/habit';
import type { HabitExtraFields } from '../utils/validation';

const SELECT_COLS =
  'id, usuario_id, nombre, meta, frecuencia, tipo, categoria, icono, ' +
  'meta_valor::float8 AS meta_valor, unidad, activo, archivado_en, creado_en';

/** Por defecto solo los activos; `incluirArchivados` devuelve todos. */
export async function findAllByUsuario(usuarioId: number, incluirArchivados = false): Promise<Habit[]> {
  const result = await query<Habit>(
    `SELECT ${SELECT_COLS} FROM habitos
      WHERE usuario_id = $1 AND ($2 OR activo)
      ORDER BY id ASC`,
    [usuarioId, incluirArchivados],
  );
  return result.rows;
}

export async function findByIdForUsuario(
  id: number,
  usuarioId: number,
  db: Queryable = pool,
): Promise<Habit | null> {
  const result = await db.query<Habit>(
    `SELECT ${SELECT_COLS} FROM habitos WHERE id = $1 AND usuario_id = $2`,
    [id, usuarioId],
  );
  return result.rows[0] ?? null;
}

export interface HabitCreateFields extends HabitExtraFields {
  nombre: string;
  meta: string;
  frecuencia: string;
  tipo: HabitTipo;
}

export async function createHabit(usuarioId: number, fields: HabitCreateFields): Promise<Habit> {
  const result = await query<Habit>(
    `INSERT INTO habitos (usuario_id, nombre, meta, frecuencia, tipo, categoria, icono, meta_valor, unidad)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING ${SELECT_COLS}`,
    [
      usuarioId,
      fields.nombre,
      fields.meta,
      fields.frecuencia,
      fields.tipo,
      fields.categoria ?? null,
      fields.icono ?? null,
      fields.meta_valor ?? null,
      fields.unidad ?? null,
    ],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('No se pudo crear el hábito');
  }
  return row;
}

export interface HabitUpdateFields extends HabitExtraFields {
  nombre?: string;
  meta?: string;
  frecuencia?: string;
}

// Lista blanca: el nombre de columna nunca viene del cliente.
const UPDATABLE: ReadonlyArray<keyof HabitUpdateFields> = [
  'nombre', 'meta', 'frecuencia', 'categoria', 'icono', 'meta_valor', 'unidad',
];

/** Actualización parcial: solo se escriben las claves presentes en `fields`. */
export async function updateHabit(
  id: number,
  usuarioId: number,
  fields: HabitUpdateFields,
): Promise<Habit | null> {
  const sets: string[] = [];
  const params: unknown[] = [id, usuarioId];
  for (const col of UPDATABLE) {
    if (fields[col] !== undefined) {
      params.push(fields[col]);
      sets.push(`${col} = $${params.length}`);
    }
  }
  if (sets.length === 0) {
    return findByIdForUsuario(id, usuarioId);
  }
  const result = await query<Habit>(
    `UPDATE habitos SET ${sets.join(', ')}
      WHERE id = $1 AND usuario_id = $2
      RETURNING ${SELECT_COLS}`,
    params,
  );
  return result.rows[0] ?? null;
}

export async function hasRecords(id: number, db: Queryable = pool): Promise<boolean> {
  const result = await db.query('SELECT 1 FROM registros_diarios WHERE habito_id = $1 LIMIT 1', [id]);
  return result.rows.length > 0;
}

export async function setArchived(
  id: number,
  usuarioId: number,
  archivado: boolean,
  db: Queryable = pool,
): Promise<Habit | null> {
  const result = await db.query<Habit>(
    `UPDATE habitos
        SET activo = NOT $3,
            archivado_en = CASE WHEN $3 THEN COALESCE(archivado_en, now()) ELSE NULL END
      WHERE id = $1 AND usuario_id = $2
      RETURNING ${SELECT_COLS}`,
    [id, usuarioId, archivado],
  );
  return result.rows[0] ?? null;
}

export async function deleteHabit(id: number, usuarioId: number, db: Queryable = pool): Promise<boolean> {
  const result = await db.query(
    'DELETE FROM habitos WHERE id = $1 AND usuario_id = $2',
    [id, usuarioId],
  );
  return (result.rowCount ?? 0) > 0;
}
