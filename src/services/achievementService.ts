import { withTransaction, type Queryable } from '../db/pool';
import {
  findAchievementFacts,
  insertUsuarioLogro,
  listLogrosForUser,
  type CompletionFactRow,
  type HabitFactRow,
  type LogroRow,
} from '../repositories/achievementRepository';
import { insertMovementForAchievement } from '../repositories/pointRepository';
import { MOTIVO_LOGRO_DESBLOQUEADO } from './pointService';
import { addDays, isoWeekday } from './progressService';

export interface Logro {
  id: number;
  nombre: string;
  descripcion: string;
  icono: string | null;
  condicion: string;
  puntos_bonus: number;
  obtenido: boolean;
  obtenido_en: string | null;
  /** Avance del usuario, limitado a `progreso_meta`; null si el logro no tiene condición evaluable. */
  progreso_actual: number | null;
  progreso_meta: number | null;
}

export interface AchievementFacts {
  habitos: ReadonlyArray<HabitFactRow>;
  cumplidos: ReadonlyArray<CompletionFactRow>;
  rachaMaxima: number;
}

/** Minúsculas y sin tildes, para comparar con el filtro del catálogo. */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function habitMatches(h: HabitFactRow, filtro: ReadonlySet<string>): boolean {
  return [h.icono, h.categoria, h.nombre, h.unidad].some((v) => v !== null && filtro.has(normalize(v)));
}

/**
 * Avance bruto hacia un logro (D-10). Pura: cada criterio tiene su regla.
 * - cumplimientos: registros cumplidos de los hábitos que encajan.
 * - dias: días distintos con al menos un registro cumplido que encaja.
 * - racha: racha máxima histórica de cualquier hábito.
 * - areas_semana: mayor número de categorías distintas cumplidas en una
 *   misma semana lunes–domingo.
 */
export function rawProgress(
  logro: Pick<LogroRow, 'criterio' | 'filtro'>,
  facts: AchievementFacts,
): number | null {
  if (logro.criterio === null) {
    return null;
  }
  if (logro.criterio === 'racha') {
    return facts.rachaMaxima;
  }
  const porId = new Map(facts.habitos.map((h) => [h.id, h]));
  if (logro.criterio === 'areas_semana') {
    const porSemana = new Map<string, Set<string>>();
    for (const c of facts.cumplidos) {
      const categoria = porId.get(c.habito_id)?.categoria;
      if (!categoria) continue;
      const lunes = addDays(c.dia, -(isoWeekday(c.dia) - 1));
      const set = porSemana.get(lunes) ?? new Set<string>();
      set.add(normalize(categoria));
      porSemana.set(lunes, set);
    }
    return Math.max(0, ...[...porSemana.values()].map((s) => s.size));
  }
  const filtro = logro.filtro ? new Set(logro.filtro.map(normalize)) : null;
  const encajan = facts.cumplidos.filter((c) => {
    const h = porId.get(c.habito_id);
    return h !== undefined && (filtro === null || habitMatches(h, filtro));
  });
  return logro.criterio === 'dias' ? new Set(encajan.map((c) => c.dia)).size : encajan.length;
}

function toLogro(row: LogroRow, facts: AchievementFacts): Logro {
  const obtenido = row.obtenido_en !== null;
  const bruto = row.progreso_meta === null ? null : rawProgress(row, facts);
  return {
    id: row.id,
    nombre: row.nombre,
    descripcion: row.descripcion,
    icono: row.icono,
    condicion: row.condicion,
    puntos_bonus: row.puntos_bonus,
    obtenido,
    obtenido_en: row.obtenido_en ? new Date(row.obtenido_en).toISOString() : null,
    progreso_actual:
      bruto === null || row.progreso_meta === null
        ? null
        : obtenido
          ? row.progreso_meta
          : Math.min(bruto, row.progreso_meta),
    progreso_meta: row.progreso_meta,
  };
}

/**
 * HU-18: evalúa todos los logros del usuario con los datos persistidos y
 * desbloquea los que ya cumplen su condición, cada uno una sola vez, con su
 * bono de VitaPuntos. Debe correr en la misma transacción que el cambio que
 * la dispara. Devuelve el catálogo actualizado y los recién desbloqueados.
 */
export async function evaluateAchievements(
  usuarioId: number,
  db: Queryable,
): Promise<{ logros: Logro[]; desbloqueados: Logro[] }> {
  const rows = await listLogrosForUser(usuarioId, db);
  const facts = await findAchievementFacts(usuarioId, db);
  const desbloqueados: Logro[] = [];
  for (const row of rows) {
    if (row.obtenido_en !== null || row.progreso_meta === null) continue;
    const bruto = rawProgress(row, facts);
    if (bruto === null || bruto < row.progreso_meta) continue;
    const obtenidoEn = await insertUsuarioLogro(usuarioId, row.id, db);
    if (obtenidoEn === null) continue; // otra petición lo registró primero
    row.obtenido_en = obtenidoEn;
    if (row.puntos_bonus > 0) {
      await insertMovementForAchievement(usuarioId, row.id, row.puntos_bonus, MOTIVO_LOGRO_DESBLOQUEADO, db);
    }
    desbloqueados.push(toLogro(row, facts));
  }
  return { logros: rows.map((r) => toLogro(r, facts)), desbloqueados };
}

/**
 * GET /api/logros: catálogo con estado y progreso. Evalúa antes de responder
 * para que logros ya alcanzados (p. ej. con historial previo a esta función)
 * no aparezcan como pendientes. Es idempotente.
 */
export async function listAchievements(usuarioId: number): Promise<Logro[]> {
  return withTransaction(async (client) => (await evaluateAchievements(usuarioId, client)).logros);
}
