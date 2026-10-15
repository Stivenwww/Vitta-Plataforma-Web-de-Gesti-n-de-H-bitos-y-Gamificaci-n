import { query } from '../db/pool';
import type { PointMovement } from '../models/pointMovement';

interface RawMovementRow {
  id: number;
  usuario_id: number;
  registro_id: number | null;
  puntos: number;
  motivo: string;
  creado_en: Date | string;
}

const SELECT_COLS = 'id, usuario_id, registro_id, puntos, motivo, creado_en';

function mapMovement(row: RawMovementRow): PointMovement {
  return {
    id: row.id,
    usuario_id: row.usuario_id,
    registro_id: row.registro_id,
    puntos: row.puntos,
    motivo: row.motivo,
    creado_en: row.creado_en instanceof Date ? row.creado_en.toISOString() : String(row.creado_en),
  };
}

/**
 * Inserta un movimiento de puntos ligado a un registro diario.
 * HAB-123: el índice único parcial uq_movimientos_puntos_registro_motivo
 * (registro_id, motivo) hace que el mismo cumplimiento nunca sume dos veces,
 * aunque lleguen dos peticiones a la vez. Devuelve true si se insertó,
 * false si ya existía (no se suma nada).
 */
export async function insertMovementForRecord(
  usuarioId: number,
  registroId: number,
  puntos: number,
  motivo: string,
): Promise<boolean> {
  const result = await query<{ id: number }>(
    `INSERT INTO movimientos_puntos (usuario_id, registro_id, puntos, motivo)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [usuarioId, registroId, puntos, motivo],
  );
  return result.rows.length > 0;
}

export async function getTotalPoints(usuarioId: number): Promise<number> {
  const result = await query<{ total: number }>(
    `SELECT COALESCE(SUM(puntos), 0)::int AS total
       FROM movimientos_puntos
      WHERE usuario_id = $1`,
    [usuarioId],
  );
  return result.rows[0]?.total ?? 0;
}

export async function listMovements(usuarioId: number, limit: number): Promise<PointMovement[]> {
  const result = await query<RawMovementRow>(
    `SELECT ${SELECT_COLS} FROM movimientos_puntos
      WHERE usuario_id = $1
      ORDER BY creado_en DESC, id DESC
      LIMIT $2`,
    [usuarioId, limit],
  );
  return result.rows.map(mapMovement);
}
