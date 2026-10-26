import type { Queryable } from '../db/pool';
import {
  findByHabit as repoFindStreak,
  upsertStreak as repoUpsert,
} from '../repositories/streakRepository';
import { findAllByHabit as repoFindRecords } from '../repositories/recordRepository';
import { findByIdForUsuario as repoFindHabit } from '../repositories/habitRepository';
import type { DailyRecord } from '../models/dailyRecord';
import type { Habit } from '../models/habit';
import type { Streak } from '../models/streak';
import { HttpError } from '../utils/httpError';
import { validateHabitId } from '../utils/validation';
import { todayIn } from '../utils/timezone';
import { addDays, isScheduled, parseFrecuencia } from './progressService';

export interface StreakDependencies {
  findHabit: (id: number, usuarioId: number) => Promise<Habit | null>;
  findStreak: (habitoId: number, db?: Queryable) => Promise<Streak | null>;
  findRecords: (habitoId: number, db?: Queryable) => Promise<DailyRecord[]>;
  upsertStreak: (habitoId: number, actual: number, maxima: number, db?: Queryable) => Promise<Streak>;
}

const defaultDependencies: StreakDependencies = {
  findHabit: repoFindHabit,
  findStreak: repoFindStreak,
  findRecords: repoFindRecords,
  upsertStreak: repoUpsert,
};

/**
 * HU-16 (D-08, D-09). Recorre los días locales desde el primer registro hasta
 * `hoy`. Pura: sin E/S.
 * - CA-01: un día cumplido suma 1.
 * - CA-02: un día programado que ya pasó sin cumplirse reinicia a 0. Los
 *   días que la frecuencia no incluye (p. ej. martes en "L,X,V") no cortan.
 * - Hoy todavía no termina: sin registro, o con avance parcial (`valor > 0`
 *   sin llegar a la meta), queda pendiente y no corta. Marcarlo
 *   explícitamente como no cumplido sí deja la racha en 0 (AGENTS §11).
 * - CA-03: `maxima` es la racha más larga del historial.
 */
export function computeStreaks(
  records: ReadonlyArray<Pick<DailyRecord, 'dia' | 'cumplido' | 'valor'>>,
  frecuencia: string,
  hoy: string,
): { actual: number; maxima: number } {
  if (records.length === 0) {
    return { actual: 0, maxima: 0 };
  }
  const porDia = new Map<string, Pick<DailyRecord, 'cumplido' | 'valor'>>();
  let primero = records[0]!.dia;
  let ultimo = hoy;
  for (const r of records) {
    porDia.set(r.dia, r);
    if (r.dia < primero) primero = r.dia;
    if (r.dia > ultimo) ultimo = r.dia;
  }
  const schedule = parseFrecuencia(frecuencia);
  let actual = 0;
  let maxima = 0;
  for (let d = primero; d <= ultimo; d = addDays(d, 1)) {
    const rec = porDia.get(d);
    if (rec?.cumplido) {
      actual += 1;
      maxima = Math.max(maxima, actual);
      continue;
    }
    if (!isScheduled(schedule, d)) {
      continue;
    }
    const pendienteHoy = d === ultimo && d >= hoy && (!rec || (rec.valor ?? 0) > 0);
    if (!pendienteHoy) {
      actual = 0;
    }
  }
  return { actual, maxima };
}

/**
 * Recalcula y persiste la racha del hábito desde sus registros.
 * `conservarMaxima`: la máxima guardada nunca baja (registro nuevo o avance);
 * al desmarcar (spec v2.0 §8.3) se pasa false para que refleje el historial.
 * No valida propiedad: lo hace quien la llama.
 */
export async function recalculateStreak(
  habitoId: number,
  frecuencia: string,
  hoy: string,
  conservarMaxima: boolean,
  db?: Queryable,
  deps: StreakDependencies = defaultDependencies,
): Promise<Streak> {
  // Secuencial: un cliente de transacción no admite consultas en paralelo.
  const records = await deps.findRecords(habitoId, db);
  const prev = conservarMaxima ? await deps.findStreak(habitoId, db) : null;
  const { actual, maxima } = computeStreaks(records, frecuencia, hoy);
  return deps.upsertStreak(habitoId, actual, Math.max(maxima, prev?.racha_maxima ?? 0), db);
}

/**
 * CA-04: racha actual y máxima. La actual se calcula al vuelo para que un
 * día perdido se refleje aunque no se haya vuelto a registrar (CA-02).
 */
export async function getStreak(
  usuarioId: number,
  habitoIdRaw: unknown,
  tz: string,
  deps: StreakDependencies = defaultDependencies,
): Promise<Streak> {
  const habitoId = validateHabitId(habitoIdRaw);
  const habit = await deps.findHabit(habitoId, usuarioId);
  if (!habit) {
    throw new HttpError(404, 'hábito no encontrado');
  }
  const [records, stored] = await Promise.all([deps.findRecords(habitoId), deps.findStreak(habitoId)]);
  const { actual, maxima } = computeStreaks(records, habit.frecuencia, todayIn(tz));
  return {
    habito_id: habitoId,
    racha_actual: actual,
    racha_maxima: Math.max(maxima, stored?.racha_maxima ?? 0),
  };
}
