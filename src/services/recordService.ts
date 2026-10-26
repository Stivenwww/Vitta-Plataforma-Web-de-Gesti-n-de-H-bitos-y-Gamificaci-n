import type { PoolClient } from 'pg';
import { withTransaction } from '../db/pool';
import {
  createRecord,
  deleteRecordAndPoints,
  findAllByHabit,
  findByHabitAndDay,
  updateRecordProgress,
} from '../repositories/recordRepository';
import { findByIdForUsuario } from '../repositories/habitRepository';
import { lockUser } from '../repositories/userRepository';
import type { DailyRecord } from '../models/dailyRecord';
import type { Habit } from '../models/habit';
import type { Streak } from '../models/streak';
import { HttpError } from '../utils/httpError';
import {
  validateCreateRecordInput,
  validateHabitId,
  validateId,
  validateProgressInput,
} from '../utils/validation';
import { todayIn } from '../utils/timezone';
import { recalculateStreak } from './streakService';
import { awardPointsForRecord, revokePointsForRecord } from './pointService';
import { evaluateAchievements, type Logro } from './achievementService';

/** Respuesta de escritura: el registro (HU-15 CA-04) más sus efectos. */
export interface RecordWriteResult extends DailyRecord {
  racha: Streak;
  logros_desbloqueados: Logro[];
}

function isUniqueViolation(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { code?: string }).code === '23505';
}

/** Bloquea al usuario y verifica que el hábito sea suyo (404 si no). */
async function lockOwnHabit(client: PoolClient, usuarioId: number, habitoId: number): Promise<Habit> {
  if (!(await lockUser(usuarioId, client))) {
    throw new HttpError(401, 'no autenticado');
  }
  const habit = await findByIdForUsuario(habitoId, usuarioId, client);
  if (!habit) {
    throw new HttpError(404, 'hábito no encontrado');
  }
  return habit;
}

function requireActive(habit: Habit): void {
  if (!habit.activo) {
    throw new HttpError(409, 'hábito archivado: no admite nuevos registros');
  }
}

export async function listRecords(usuarioId: number, habitoIdRaw: unknown): Promise<DailyRecord[]> {
  const habitoId = validateHabitId(habitoIdRaw);
  const habit = await findByIdForUsuario(habitoId, usuarioId);
  if (!habit) {
    throw new HttpError(404, 'hábito no encontrado');
  }
  return findAllByHabit(habitoId);
}

/**
 * HU-15 → HU-16 → puntos → logros en UNA transacción: o se guarda todo o
 * nada. Un día ya registrado → 409 (CA-03), también ante carreras gracias al
 * índice único uq_registros_habito_dia.
 */
export async function createRecordService(
  usuarioId: number,
  habitoIdRaw: unknown,
  body: unknown,
  tz: string,
): Promise<RecordWriteResult> {
  const habitoId = validateHabitId(habitoIdRaw);
  const input = validateCreateRecordInput(body, tz);
  try {
    return await withTransaction(async (client) => {
      const habit = await lockOwnHabit(client, usuarioId, habitoId);
      requireActive(habit);
      if (await findByHabitAndDay(habitoId, input.dia, client)) {
        throw new HttpError(409, 'ya existe registro para esta fecha');
      }
      const record = await createRecord({ habitoId, ...input }, client);
      const racha = await recalculateStreak(habitoId, habit.frecuencia, todayIn(tz), true, client);
      // HAB-125: solo un cumplimiento suma puntos; HAB-123: idempotente por registro.
      if (record.cumplido) {
        await awardPointsForRecord(usuarioId, record.id, client);
      }
      const { desbloqueados } = await evaluateAchievements(usuarioId, client);
      return { ...record, racha, logros_desbloqueados: desbloqueados };
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new HttpError(409, 'ya existe registro para esta fecha');
    }
    throw err;
  }
}

/**
 * Avance parcial del día (PATCH /api/habits/:id/progreso). `valor` es el
 * total acumulado del día, no un incremento. Crea el registro del día o
 * actualiza el existente (nunca duplica). Queda cumplido solo cuando
 * `valor >= meta_valor`; si baja de la meta se retiran sus puntos.
 */
export async function saveProgressService(
  usuarioId: number,
  habitoIdRaw: unknown,
  body: unknown,
  tz: string,
): Promise<RecordWriteResult> {
  const habitoId = validateHabitId(habitoIdRaw);
  const input = validateProgressInput(body, tz);
  try {
    return await withTransaction(async (client) => {
      const habit = await lockOwnHabit(client, usuarioId, habitoId);
      requireActive(habit);
      if (habit.meta_valor === null) {
        throw new HttpError(400, 'el hábito no tiene meta numérica (meta_valor): use POST /records');
      }
      const cumplido = input.valor >= habit.meta_valor;
      const existing = await findByHabitAndDay(habitoId, input.dia, client);
      const record = existing
        ? await updateRecordProgress(existing.id, { cumplido, valor: input.valor, notas: input.notas }, client)
        : await createRecord(
            { habitoId, fecha: input.fecha, dia: input.dia, cumplido, valor: input.valor, notas: input.notas ?? null },
            client,
          );
      const antes = existing?.cumplido ?? false;
      if (cumplido && !antes) {
        await awardPointsForRecord(usuarioId, record.id, client);
      } else if (!cumplido && antes) {
        await revokePointsForRecord(record.id, client);
      }
      // Bajar de la meta es una corrección: la máxima se recalcula del historial.
      const racha = await recalculateStreak(habitoId, habit.frecuencia, todayIn(tz), !(antes && !cumplido), client);
      const { desbloqueados } = await evaluateAchievements(usuarioId, client);
      return { ...record, racha, logros_desbloqueados: desbloqueados };
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new HttpError(409, 'el registro de este día se está guardando; reintente');
    }
    throw err;
  }
}

/**
 * Desmarcar un hábito (HAB-94, spec v2.0 §4.3 "Deshacer un registro"):
 * borra el registro y sus puntos y recalcula la racha, en una transacción.
 * Los logros ya obtenidos no se retiran.
 */
export async function deleteRecordService(
  usuarioId: number,
  habitoIdRaw: unknown,
  registroIdRaw: unknown,
  tz: string,
) {
  const habitoId = validateHabitId(habitoIdRaw);
  const registroId = validateId(registroIdRaw, 'id de registro');
  return withTransaction(async (client) => {
    const habit = await lockOwnHabit(client, usuarioId, habitoId);
    if (!(await deleteRecordAndPoints(registroId, habitoId, client))) {
      throw new HttpError(404, 'registro no encontrado');
    }
    const racha = await recalculateStreak(habitoId, habit.frecuencia, todayIn(tz), false, client);
    return { eliminado: true, registro_id: registroId, racha };
  });
}
