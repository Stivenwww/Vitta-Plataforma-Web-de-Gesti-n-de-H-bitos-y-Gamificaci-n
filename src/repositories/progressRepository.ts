import { query } from '../db/pool';

/** Un registro diario con su día local (`YYYY-MM-DD`, columna `dia`). */
export interface DayRecordRow {
  id: number;
  habito_id: number;
  dia: string;
  cumplido: boolean;
  valor: number | null;
}

export interface HabitCalendarRow {
  id: number;
  nombre: string;
  meta: string;
  frecuencia: string;
  activo: boolean;
  creado_en: Date;
  archivado_en: Date | null;
}

export interface HabitStreakRow {
  habito_id: number;
  nombre: string;
  frecuencia: string;
  racha_actual: number;
  racha_maxima: number;
  /** Último día local con registro cumplido; null si nunca. */
  ultimo_cumplido_dia: string | null;
}

const RECORD_COLS =
  "r.id, r.habito_id, to_char(r.dia, 'YYYY-MM-DD') AS dia, r.cumplido, r.valor::float8 AS valor";

export async function findRecordDaysByHabit(
  habitoId: number,
  desde: string,
  hasta: string,
): Promise<DayRecordRow[]> {
  const result = await query<DayRecordRow>(
    `SELECT ${RECORD_COLS}
       FROM registros_diarios r
      WHERE r.habito_id = $1 AND r.dia BETWEEN $2::date AND $3::date
      ORDER BY r.dia ASC`,
    [habitoId, desde, hasta],
  );
  return result.rows;
}

/** Registros del usuario en el rango, incluidos los de hábitos archivados (historial). */
export async function findRecordDaysByUsuario(
  usuarioId: number,
  desde: string,
  hasta: string,
): Promise<DayRecordRow[]> {
  const result = await query<DayRecordRow>(
    `SELECT ${RECORD_COLS}
       FROM registros_diarios r
       JOIN habitos h ON h.id = r.habito_id
      WHERE h.usuario_id = $1 AND r.dia BETWEEN $2::date AND $3::date
      ORDER BY r.dia ASC`,
    [usuarioId, desde, hasta],
  );
  return result.rows;
}

/** Todos los hábitos del usuario (también archivados) con sus fechas de vigencia. */
export async function findCalendarHabitsByUsuario(usuarioId: number): Promise<HabitCalendarRow[]> {
  const result = await query<HabitCalendarRow>(
    `SELECT id, nombre, meta, frecuencia, activo, creado_en, archivado_en
       FROM habitos
      WHERE usuario_id = $1
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
            (SELECT to_char(max(r.dia), 'YYYY-MM-DD')
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
