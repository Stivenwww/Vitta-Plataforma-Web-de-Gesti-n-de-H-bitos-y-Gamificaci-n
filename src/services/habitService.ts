import { withTransaction } from '../db/pool';
import {
  createHabit as repoCreate,
  deleteHabit as repoDelete,
  findAllByUsuario as repoFindAll,
  findByIdForUsuario as repoFindById,
  hasRecords as repoHasRecords,
  setArchived as repoSetArchived,
  updateHabit as repoUpdate,
} from '../repositories/habitRepository';
import type { Habit } from '../models/habit';
import { HttpError } from '../utils/httpError';
import {
  validateCreateHabitInput,
  validateHabitId,
  validateUpdateHabitInput,
} from '../utils/validation';

/** CA-04: solo los del usuario. `?incluir_archivados=true` añade los archivados. */
export async function listHabits(usuarioId: number, incluirArchivadosRaw?: unknown): Promise<Habit[]> {
  return repoFindAll(usuarioId, incluirArchivadosRaw === 'true' || incluirArchivadosRaw === '1');
}

export async function getHabit(usuarioId: number, idRaw: unknown): Promise<Habit> {
  const id = validateHabitId(idRaw);
  const habit = await repoFindById(id, usuarioId);
  if (!habit) {
    throw new HttpError(404, 'hábito no encontrado');
  }
  return habit;
}

export async function createHabitService(usuarioId: number, body: unknown): Promise<Habit> {
  return repoCreate(usuarioId, validateCreateHabitInput(body));
}

/** CA-02: actualización parcial; los campos no enviados se conservan. */
export async function updateHabitService(usuarioId: number, idRaw: unknown, body: unknown): Promise<Habit> {
  const id = validateHabitId(idRaw);
  const fields = validateUpdateHabitInput(body);
  const habit = await repoUpdate(id, usuarioId, fields);
  if (!habit) {
    throw new HttpError(404, 'hábito no encontrado');
  }
  return habit;
}

/** Archivado lógico (D-11): oculta el hábito y conserva todo su historial. */
export async function setArchivedService(usuarioId: number, idRaw: unknown, archivado: boolean): Promise<Habit> {
  const id = validateHabitId(idRaw);
  const habit = await repoSetArchived(id, usuarioId, archivado);
  if (!habit) {
    throw new HttpError(404, 'hábito no encontrado');
  }
  return habit;
}

/**
 * HU-14 CA-03 (D-11): sin historial se elimina; con historial se archiva en
 * lugar de fallar con 409, para no perder registros, rachas ni puntos.
 */
export async function deleteHabitService(
  usuarioId: number,
  idRaw: unknown,
): Promise<{ mensaje: string; archivado: boolean; habito?: Habit }> {
  const id = validateHabitId(idRaw);
  try {
    return await withTransaction(async (client) => {
      const habit = await repoFindById(id, usuarioId, client);
      if (!habit) {
        throw new HttpError(404, 'hábito no encontrado');
      }
      if (await repoHasRecords(id, client)) {
        const archivado = await repoSetArchived(id, usuarioId, true, client);
        return { mensaje: 'hábito archivado: conserva su historial', archivado: true, habito: archivado ?? habit };
      }
      await repoDelete(id, usuarioId, client);
      return { mensaje: 'hábito eliminado', archivado: false };
    });
  } catch (err: unknown) {
    // Un registro creado en paralelo hace saltar la FK RESTRICT: no se borra nada.
    // PostgreSQL ≥ 18 lo informa como 23001 (restrict_violation); antes, 23503.
    const code = err && typeof err === 'object' ? (err as { code?: string }).code : undefined;
    if (code === '23503' || code === '23001') {
      throw new HttpError(409, 'no se puede eliminar: tiene historial registrado; archívelo');
    }
    throw err;
  }
}
