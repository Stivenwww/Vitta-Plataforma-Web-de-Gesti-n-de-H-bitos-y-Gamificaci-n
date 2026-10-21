import { query } from '../db/pool';

/** Un registro diario reducido a su día calendario UTC (`YYYY-MM-DD`). */
export interface DayRecordRow {
  id: number;
  habito_id: number;
  dia: string;
  cumplido: boolean;
}

export interface HabitScheduleRow {
  id: number;
  nombre: string;
  meta: string;
  frecuencia: string;
  /** Día UTC (`YYYY-MM-DD`) en que se creó el hábito. */
  creado_dia: string;
}

export interface HabitStreakRow {
  habito_id: number;
  nombre: string;
  frecuencia: string;
  racha_actual: number;
  racha_maxima: number;
  /** Último día UTC con registro cumplido; null si nunca. */
  ultimo_cumplido_dia: string | null;
}

const DIA_SQL = "to_char((r.fecha AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD')";

export async function findRecordDaysByHabit(
  habitoId: number,
  desde: string,
  hasta: string,
): Promise<DayRecordRow[]> {
  const result = await query<DayRecordRow>(
    `SELECT r.id, r.habito_id, ${DIA_SQL} AS dia, r.cumplido
       FROM registros_diarios r
      WHERE r.habito_id = $1
        AND (r.fecha AT TIME ZONE 'UTC')::date BETWEEN $2::date AND $3::date
      ORDER BY r.fecha ASC`,
    [habitoId, desde, hasta],
  );
  return result.rows;
}

export async function findRecordDaysByUsuario(
  usuarioId: number,
  desde: string,
  hasta: string,
): Promise<DayRecordRow[]> {
  const result = await query<DayRecordRow>(
    `SELECT r.id, r.habito_id, ${DIA_SQL} AS dia, r.cumplido
       FROM registros_diarios r
       JOIN habitos h ON h.id = r.habito_id
      WHERE h.usuario_id = $1 AND h.activo
        AND (r.fecha AT TIME ZONE 'UTC')::date BETWEEN $2::date AND $3::date
      ORDER BY r.fecha ASC`,
    [usuarioId, desde, hasta],
  );
  return result.rows;
}

export async function findActiveHabitsByUsuario(usuarioId: number): Promise<HabitScheduleRow[]> {
  const result = await query<HabitScheduleRow>(
    `SELECT id, nombre, meta, frecuencia,
            to_char((creado_en AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS creado_dia
       FROM habitos
      WHERE usuario_id = $1 AND activo
      ORDER BY id ASC`,
    [usuarioId],
  );
  return result.rows;
}

export async function findStreaksByUsuario(usuarioId: number): Promise<HabitStreakRow[]> {
  const result = await query<HabitStreakRow>(
    `SELECT h.id AS habito_id, h.nombre, h.frecuencia,
            COALESCE(ra.racha_actual, 0) AS racha_actual,
            COALESCE(ra.racha_maxima, 0) AS racha_maxima,
            (SELECT to_char(max((r.fecha AT TIME ZONE 'UTC')::date), 'YYYY-MM-DD')
               FROM registros_diarios r
              WHERE r.habito_id = h.id AND r.cumplido) AS ultimo_cumplido_dia
       FROM habitos h
       LEFT JOIN rachas ra ON ra.habito_id = h.id
      WHERE h.usuario_id = $1 AND h.activo
      ORDER BY h.id ASC`,
    [usuarioId],
  );
  return result.rows;
}
