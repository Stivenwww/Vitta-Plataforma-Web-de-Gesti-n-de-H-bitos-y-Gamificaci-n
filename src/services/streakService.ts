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

export interface StreakDependencies {
  findHabit: (id: number, usuarioId: number) => Promise<Habit | null>;
  findStreak: (habitoId: number) => Promise<Streak | null>;
  findRecords: (habitoId: number) => Promise<DailyRecord[]>;
  upsertStreak: (habitoId: number, actual: number, maxima: number) => Promise<Streak>;
}

const defaultDependencies: StreakDependencies = {
  findHabit: repoFindHabit,
  findStreak: repoFindStreak,
  findRecords: repoFindRecords,
  upsertStreak: repoUpsert,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Día calendario UTC `YYYY-MM-DD` de un instante ISO 8601. */
export function toUtcDay(fechaIso: string): string {
  return new Date(fechaIso).toISOString().slice(0, 10);
}

function prevDay(day: string): string {
  return new Date(new Date(`${day}T00:00:00Z`).getTime() - DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/**
 * Calcula la racha actual terminando en `recordDay` (día UTC del registro
 * recién guardado) a partir de los días cumplidos previos.
 * Pura: sin E/S, testeable sin BD.
 */
export function computeActualStreak(
  cumplidosDiasPrevios: Set<string>,
  recordDay: string,
  cumplido: boolean,
): number {
  // CA-02 / ejemplo AGENTS §11: día no cumplido → racha 0.
  if (!cumplido) {
    return 0;
  }
  // CA-01: día cumplido → 1 + consecutivos previos; un hueco (día sin
  // registro cumplido) corta la racha y queda en 1.
  let actual = 1;
  let d = prevDay(recordDay);
  while (cumplidosDiasPrevios.has(d)) {
    actual += 1;
    d = prevDay(d);
  }
  return actual;
}

async function requireOwnHabit(
  usuarioId: number,
  habitoIdRaw: unknown,
  deps: StreakDependencies,
): Promise<number> {
  const habitoId = validateHabitId(habitoIdRaw);
  const habit = await deps.findHabit(habitoId, usuarioId);
  if (!habit) {
    throw new HttpError(404, 'hábito no encontrado');
  }
  return habitoId;
}

/**
 * Recalcula y persiste la racha tras guardar un registro diario (HU-15 → HU-16).
 * No valida propiedad: la llama `createRecordService`, que ya la verificó.
 */
export async function updateStreakForRecord(
  habitoId: number,
  recordFechaIso: string,
  cumplido: boolean,
  deps: StreakDependencies = defaultDependencies,
): Promise<Streak> {
  const recordDay = toUtcDay(recordFechaIso);
  const [records, prev] = await Promise.all([
    deps.findRecords(habitoId),
    deps.findStreak(habitoId),
  ]);
  const cumplidos = new Set<string>();
  for (const r of records) {
    if (r.cumplido && toUtcDay(r.fecha) !== recordDay) {
      cumplidos.add(toUtcDay(r.fecha));
    }
  }
  const actual = computeActualStreak(cumplidos, recordDay, cumplido);
  // CA-03: la máxima nunca disminuye.
  const maxima = Math.max(prev?.racha_maxima ?? 0, actual);
  return deps.upsertStreak(habitoId, actual, maxima);
}

/** CA-04: expone racha actual y máxima. Sin fila → 0/0. */
export async function getStreak(
  usuarioId: number,
  habitoIdRaw: unknown,
  deps: StreakDependencies = defaultDependencies,
): Promise<Streak> {
  const habitoId = await requireOwnHabit(usuarioId, habitoIdRaw, deps);
  const streak = await deps.findStreak(habitoId);
  return streak ?? { habito_id: habitoId, racha_actual: 0, racha_maxima: 0 };
}
