import { pool, type Queryable } from '../db/pool';
import type { DailyRecord } from '../models/dailyRecord';

const SELECT_COLS =
  "id, habito_id, fecha, to_char(dia, 'YYYY-MM-DD') AS dia, cumplido, " +
  'valor::float8 AS valor, reflexion AS notas';

// `pg` devuelve TIMESTAMPTZ como Date; la API expone ISO 8601 UTC.
interface RawRecordRow extends Omit<DailyRecord, 'fecha'> {
  fecha: Date | string;
}

function mapRecord(row: RawRecordRow): DailyRecord {
  return {
    id: row.id,
    habito_id: row.habito_id,
    fecha: row.fecha instanceof Date ? row.fecha.toISOString() : String(row.fecha),
    dia: row.dia,
    cumplido: row.cumplido,
    valor: row.valor,
    notas: row.notas,
  };
}

/** Unicidad HU-15 CA-03 por día local (índice uq_registros_habito_dia). */
export async function findByHabitAndDay(
  habitoId: number,
  dia: string,
  db: Queryable = pool,
): Promise<DailyRecord | null> {
  const result = await db.query<RawRecordRow>(
    `SELECT ${SELECT_COLS} FROM registros_diarios WHERE habito_id = $1 AND dia = $2::date`,
    [habitoId, dia],
  );
  const row = result.rows[0];
  return row ? mapRecord(row) : null;
}

export async function findAllByHabit(habitoId: number, db: Queryable = pool): Promise<DailyRecord[]> {
  const result = await db.query<RawRecordRow>(
    `SELECT ${SELECT_COLS} FROM registros_diarios WHERE habito_id = $1 ORDER BY dia ASC`,
    [habitoId],
  );
  return result.rows.map(mapRecord);
}

export interface NewRecord {
  habitoId: number;
  fecha: string;
  dia: string;
  cumplido: boolean;
  valor: number | null;
  notas: string | null;
}

export async function createRecord(rec: NewRecord, db: Queryable = pool): Promise<DailyRecord> {
  const result = await db.query<RawRecordRow>(
    `INSERT INTO registros_diarios (habito_id, fecha, dia, cumplido, valor, reflexion)
     VALUES ($1, $2::timestamptz, $3::date, $4, $5, $6)
     RETURNING ${SELECT_COLS}`,
    [rec.habitoId, rec.fecha, rec.dia, rec.cumplido, rec.valor, rec.notas],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('No se pudo guardar el registro');
  }
  return mapRecord(row);
}

/** Actualiza avance y estado; las notas solo cambian si `notas !== undefined`. */
export async function updateRecordProgress(
  id: number,
  fields: { cumplido: boolean; valor: number; notas: string | null | undefined },
  db: Queryable = pool,
): Promise<DailyRecord> {
  const result = await db.query<RawRecordRow>(
    `UPDATE registros_diarios
        SET cumplido = $2,
            valor = $3,
            reflexion = CASE WHEN $4 THEN $5 ELSE reflexion END
      WHERE id = $1
      RETURNING ${SELECT_COLS}`,
    [id, fields.cumplido, fields.valor, fields.notas !== undefined, fields.notas ?? null],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('No se pudo actualizar el registro');
  }
  return mapRecord(row);
}

/**
 * Desmarcar (HAB-94): borra el registro diario y el movimiento de VitaPuntos
 * que generó (la FK movimientos_puntos.registro_id es ON DELETE RESTRICT, así
 * que primero va el movimiento). Debe correr dentro de una transacción.
 */
export async function deleteRecordAndPoints(
  registroId: number,
  habitoId: number,
  db: Queryable,
): Promise<boolean> {
  await db.query(
    `DELETE FROM movimientos_puntos
      WHERE registro_id IN (SELECT id FROM registros_diarios WHERE id = $1 AND habito_id = $2)`,
    [registroId, habitoId],
  );
  const result = await db.query(
    'DELETE FROM registros_diarios WHERE id = $1 AND habito_id = $2',
    [registroId, habitoId],
  );
  return (result.rowCount ?? 0) > 0;
}
