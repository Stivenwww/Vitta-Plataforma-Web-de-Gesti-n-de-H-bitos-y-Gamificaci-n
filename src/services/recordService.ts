import {
  createRecord as repoCreate,
  findAllByHabit as repoFindAll,
  findExisting as repoFindExisting,
} from '../repositories/recordRepository';
import { findByIdForUsuario as repoFindHabit } from '../repositories/habitRepository';
import type { DailyRecord } from '../models/dailyRecord';
import type { Habit } from '../models/habit';
import type { Streak } from '../models/streak';
import { HttpError } from '../utils/httpError';
import { validateCreateRecordInput, validateHabitId } from '../utils/validation';
import { updateStreakForRecord as defaultUpdateStreak } from './streakService';
import { awardPointsForRecord as defaultAwardPoints } from './pointService';
import { deleteRecordAndPoints as defaultDeleteRecord } from '../repositories/recordUndoRepository';
import { recomputeStreak as defaultRecomputeStreak } from './streakRecalc';

export interface RecordDependencies {
  findHabit: (id: number, usuarioId: number) => Promise<Habit | null>;
  findExisting: (habitoId: number, fecha: string) => Promise<DailyRecord | null>;
  findAllByHabit: (habitoId: number) => Promise<DailyRecord[]>;
  createRecord: (
    habitoId: number,
    fecha: string,
    cumplido: boolean,
    valor: number | null,
  ) => Promise<DailyRecord>;
  updateStreak: (
    habitoId: number,
    fechaIso: string,
    cumplido: boolean,
  ) => Promise<Streak>;
  awardPoints: (usuarioId: number, registroId: number) => Promise<number>;
  deleteRecordWithPoints: (registroId: number, habitoId: number) => Promise<boolean>;
  recomputeStreak: (habitoId: number) => Promise<Streak>;
}

const defaultDependencies: RecordDependencies = {
  findHabit: repoFindHabit,
  findExisting: repoFindExisting,
  findAllByHabit: repoFindAll,
  createRecord: repoCreate,
  updateStreak: defaultUpdateStreak,
  awardPoints: defaultAwardPoints,
  deleteRecordWithPoints: defaultDeleteRecord,
  recomputeStreak: defaultRecomputeStreak,
};

async function requireOwnHabit(
  usuarioId: number,
  habitoIdRaw: unknown,
  deps: RecordDependencies,
): Promise<number> {
  const habitoId = validateHabitId(habitoIdRaw);
  const habit = await deps.findHabit(habitoId, usuarioId);
  if (!habit) {
    throw new HttpError(404, 'hábito no encontrado');
  }
  return habitoId;
}

export async function listRecords(
  usuarioId: number,
  habitoIdRaw: unknown,
  deps: RecordDependencies = defaultDependencies,
) {
  const habitoId = await requireOwnHabit(usuarioId, habitoIdRaw, deps);
  return deps.findAllByHabit(habitoId);
}

export async function createRecordService(
  usuarioId: number,
  habitoIdRaw: unknown,
  body: unknown,
  deps: RecordDependencies = defaultDependencies,
) {
  const habitoId = await requireOwnHabit(usuarioId, habitoIdRaw, deps);
  const input = validateCreateRecordInput(body);
  const existing = await deps.findExisting(habitoId, input.fecha);
  if (existing) {
    throw new HttpError(409, 'ya existe registro para esta fecha');
  }
  try {
    // RETURNING * sin segunda consulta. HU-16: tras guardar, se recalcula
    // la racha; la respuesta sigue siendo el registro (HU-15 CA-04) y la
    // racha queda consultable en GET /api/habits/:id/streak (HU-16 CA-04).
    const record = await deps.createRecord(habitoId, input.fecha, input.cumplido, input.valor);
    await deps.updateStreak(habitoId, record.fecha, input.cumplido);
    // HAB-125: solo un cumplimiento suma puntos. HAB-123: es idempotente
    // por registro (índice único en movimientos_puntos), nunca suma doble.
    if (input.cumplido) {
      await deps.awardPoints(usuarioId, record.id);
    }
    return record;
  } catch (err: unknown) {
    // Protección contra carreras concurrentes: UNIQUE(habito_id, fecha).
    if (err && typeof err === 'object' && (err as { code?: string }).code === '23505') {
      throw new HttpError(409, 'ya existe registro para esta fecha');
    }
    throw err;
  }
}

function validateRegistroId(id: unknown): number {
  const n = typeof id === 'string' ? Number(id) : id;
  if (typeof n !== 'number' || !Number.isInteger(n) || n <= 0) {
    throw new HttpError(400, 'id de registro inválido');
  }
  return n;
}

/**
 * Desmarcar un hábito (HAB-94, spec v2.0 §4.3 "Deshacer un registro"):
 * borra el registro y sus puntos y recalcula la racha.
 */
export async function deleteRecordService(
  usuarioId: number,
  habitoIdRaw: unknown,
  registroIdRaw: unknown,
  deps: RecordDependencies = defaultDependencies,
) {
  const habitoId = await requireOwnHabit(usuarioId, habitoIdRaw, deps);
  const registroId = validateRegistroId(registroIdRaw);
  const registros = await deps.findAllByHabit(habitoId);
  if (!registros.some((r) => r.id === registroId)) {
    throw new HttpError(404, 'registro no encontrado');
  }
  const eliminado = await deps.deleteRecordWithPoints(registroId, habitoId);
  if (!eliminado) {
    throw new HttpError(404, 'registro no encontrado');
  }
  const racha = await deps.recomputeStreak(habitoId);
  return { eliminado: true, registro_id: registroId, racha };
}
