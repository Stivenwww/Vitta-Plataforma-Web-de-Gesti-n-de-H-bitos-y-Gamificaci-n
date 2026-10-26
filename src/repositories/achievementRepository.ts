import { pool, type Queryable } from '../db/pool';

export type CriterioLogro = 'cumplimientos' | 'dias' | 'racha' | 'areas_semana';

export interface LogroRow {
  id: number;
  nombre: string;
  descripcion: string;
  icono: string | null;
  condicion: string;
  puntos_bonus: number;
  criterio: CriterioLogro | null;
  filtro: string[] | null;
  progreso_meta: number | null;
  obtenido_en: Date | null;
}

/** Catálogo completo de logros con la fecha en que el usuario obtuvo cada uno. */
export async function listLogrosForUser(usuarioId: number, db: Queryable = pool): Promise<LogroRow[]> {
  const r = await db.query<LogroRow>(
    `SELECT l.id, l.nombre, l.descripcion, l.icono, l.condicion, l.puntos_bonus,
            l.criterio, l.filtro, l.progreso_meta, ul.obtenido_en
       FROM logros l
       LEFT JOIN usuario_logros ul ON ul.logro_id = l.id AND ul.usuario_id = $1
      ORDER BY l.id`,
    [usuarioId],
  );
  return r.rows;
}

export interface HabitFactRow {
  id: number;
  nombre: string;
  categoria: string | null;
  icono: string | null;
  unidad: string | null;
}

export interface CompletionFactRow {
  habito_id: number;
  dia: string;
}

/** Datos persistidos con los que se evalúan los logros (incluye archivados). */
export async function findAchievementFacts(
  usuarioId: number,
  db: Queryable = pool,
): Promise<{ habitos: HabitFactRow[]; cumplidos: CompletionFactRow[]; rachaMaxima: number }> {
  // Secuencial: `db` suele ser el cliente de una transacción.
  const habitos = await db.query<HabitFactRow>(
    'SELECT id, nombre, categoria, icono, unidad FROM habitos WHERE usuario_id = $1',
    [usuarioId],
  );
  const cumplidos = await db.query<CompletionFactRow>(
    `SELECT r.habito_id, to_char(r.dia, 'YYYY-MM-DD') AS dia
       FROM registros_diarios r
       JOIN habitos h ON h.id = r.habito_id
      WHERE h.usuario_id = $1 AND r.cumplido`,
    [usuarioId],
  );
  const racha = await db.query<{ maxima: number }>(
    `SELECT COALESCE(MAX(ra.racha_maxima), 0)::int AS maxima
       FROM rachas ra JOIN habitos h ON h.id = ra.habito_id
      WHERE h.usuario_id = $1`,
    [usuarioId],
  );
  return { habitos: habitos.rows, cumplidos: cumplidos.rows, rachaMaxima: racha.rows[0]?.maxima ?? 0 };
}

/**
 * Registra el logro una sola vez (UNIQUE uq_usuario_logro). Devuelve la
 * fecha de desbloqueo si se insertó ahora, o null si ya lo tenía.
 */
export async function insertUsuarioLogro(
  usuarioId: number,
  logroId: number,
  db: Queryable = pool,
): Promise<Date | null> {
  const r = await db.query<{ obtenido_en: Date }>(
    `INSERT INTO usuario_logros (usuario_id, logro_id)
     VALUES ($1, $2)
     ON CONFLICT (usuario_id, logro_id) DO NOTHING
     RETURNING obtenido_en`,
    [usuarioId, logroId],
  );
  return r.rows[0]?.obtenido_en ?? null;
}
