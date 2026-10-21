import { findAllByHabit as repoFindRecords } from '../repositories/recordRepository';
import { upsertStreak as repoUpsert } from '../repositories/streakRepository';
import type { DailyRecord } from '../models/dailyRecord';
import type { Streak } from '../models/streak';

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDay(fechaIso: string): string {
  return new Date(fechaIso).toISOString().slice(0, 10);
}

function prevDay(day: string): string {
  return new Date(new Date(`${day}T00:00:00Z`).getTime() - DAY_MS).toISOString().slice(0, 10);
}

/**
 * Recalcula racha actual y máxima desde cero a partir de los registros que
 * quedan (se usa al desmarcar, spec v2.0 §8.3: "corregir un registro
 * recalcula puntos y rachas"). Misma regla que `streakService`: días
 * calendario UTC consecutivos cumplidos; la actual termina en el último
 * registro y vale 0 si ese registro no fue cumplido. Pura: sin E/S.
 */
export function computeStreaksFromRecords(
  records: ReadonlyArray<Pick<DailyRecord, 'fecha' | 'cumplido'>>,
): { actual: number; maxima: number } {
  if (records.length === 0) {
    return { actual: 0, maxima: 0 };
  }
  const cumplidos = new Set<string>();
  let ultimoDia = '';
  let ultimoCumplido = false;
  for (const r of records) {
    const day = utcDay(r.fecha);
    if (r.cumplido) {
      cumplidos.add(day);
    }
    if (day > ultimoDia) {
      ultimoDia = day;
      ultimoCumplido = r.cumplido;
    }
  }

  let maxima = 0;
  for (const day of cumplidos) {
    if (cumplidos.has(prevDay(day))) {
      continue; // no es el inicio de una racha
    }
    let largo = 1;
    let d = new Date(new Date(`${day}T00:00:00Z`).getTime() + DAY_MS).toISOString().slice(0, 10);
    while (cumplidos.has(d)) {
      largo += 1;
      d = new Date(new Date(`${d}T00:00:00Z`).getTime() + DAY_MS).toISOString().slice(0, 10);
    }
    maxima = Math.max(maxima, largo);
  }

  let actual = 0;
  if (ultimoCumplido) {
    actual = 1;
    let d = prevDay(ultimoDia);
    while (cumplidos.has(d)) {
      actual += 1;
      d = prevDay(d);
    }
  }
  return { actual, maxima };
}

export interface StreakRecalcDependencies {
  findRecords: (habitoId: number) => Promise<DailyRecord[]>;
  upsertStreak: (habitoId: number, actual: number, maxima: number) => Promise<Streak>;
}

const defaultDependencies: StreakRecalcDependencies = {
  findRecords: repoFindRecords,
  upsertStreak: repoUpsert,
};

export async function recomputeStreak(
  habitoId: number,
  deps: StreakRecalcDependencies = defaultDependencies,
): Promise<Streak> {
  const records = await deps.findRecords(habitoId);
  const { actual, maxima } = computeStreaksFromRecords(records);
  return deps.upsertStreak(habitoId, actual, maxima);
}
