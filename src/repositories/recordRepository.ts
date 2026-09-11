import { query } from '../db/pool';
import type { DailyRecord } from '../models/dailyRecord';

const SELECT_COLS = 'id, habito_id, fecha, cumplido, valor';

// `pg` devuelve TIMESTAMPTZ como Date; la API expone ISO 8601 UTC.
interface RawRecordRow {
  id: number;
  habito_id: number;
  fecha: Date | string;
  cumplido: boolean;
  valor: string | number | null;
}

function mapRecord(row: RawRecordRow): DailyRecord {
  return {
    id: row.id,
    habito_id: row.habito_id,
    fecha: row.fecha instanceof Date ? row.fecha.toISOString() : String(row.fecha),
    cumplido: row.cumplido,
    valor: row.valor,
  };
}

export async function findExisting(
  habitoId: number,
  fecha: string,
): Promise<DailyRecord | null> {
  // Unicidad por día calendario UTC (índice uq_registros_habito_dia_utc):
  // dos horas del mismo día cuentan como el mismo registro diario.
  const result = await query<RawRecordRow>(
    `SELECT ${SELECT_COLS} FROM registros_diarios
      WHERE habito_id = $1
        AND ((fecha AT TIME ZONE 'UTC')::date = ($2::timestamptz AT TIME ZONE 'UTC')::date)`,
    [habitoId, fecha],
  );
  const row = result.rows[0];
  return row ? mapRecord(row) : null;
}

export async function findAllByHabit(habitoId: number): Promise<DailyRecord[]> {
  const result = await query<RawRecordRow>(
    `SELECT ${SELECT_COLS} FROM registros_diarios WHERE habito_id = $1 ORDER BY fecha ASC`,
    [habitoId],
  );
  return result.rows.map(mapRecord);
}

export async function createRecord(
  habitoId: number,
  fecha: string,
  cumplido: boolean,
  valor: number | null,
): Promise<DailyRecord> {
  const result = await query<RawRecordRow>(
    `INSERT INTO registros_diarios (habito_id, fecha, cumplido, valor)
     VALUES ($1, $2::timestamptz, $3, $4)
     RETURNING ${SELECT_COLS}`,
    [habitoId, fecha, cumplido, valor],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('No se pudo guardar el registro');
  }
  return mapRecord(row);
}
