import {
  createHabit as repoCreate,
  deleteHabit as repoDelete,
  findAllByUsuario as repoFindAll,
  findByIdForUsuario as repoFindById,
  updateHabit as repoUpdate,
  type HabitUpdateFields,
} from '../repositories/habitRepository';
import type { Habit, HabitTipo } from '../models/habit';
import { HttpError } from '../utils/httpError';
import {
  validateCreateHabitInput,
  validateHabitId,
  validateUpdateHabitInput,
} from '../utils/validation';

export interface HabitRepository {
  findAllByUsuario: (usuarioId: number) => Promise<Habit[]>;
  findByIdForUsuario: (id: number, usuarioId: number) => Promise<Habit | null>;
  createHabit: (
    usuarioId: number,
    nombre: string,
    meta: string,
    frecuencia: string,
    tipo: HabitTipo,
  ) => Promise<Habit>;
  updateHabit: (
    id: number,
    usuarioId: number,
    fields: HabitUpdateFields,
  ) => Promise<Habit | null>;
  deleteHabit: (id: number, usuarioId: number) => Promise<boolean>;
}

const defaultRepository: HabitRepository = {
  findAllByUsuario: repoFindAll,
  findByIdForUsuario: repoFindById,
  createHabit: repoCreate,
  updateHabit: repoUpdate,
  deleteHabit: repoDelete,
};

export async function listHabits(usuarioId: number, repo: HabitRepository = defaultRepository) {
  return repo.findAllByUsuario(usuarioId);
}

export async function getHabit(
  usuarioId: number,
  idRaw: unknown,
  repo: HabitRepository = defaultRepository,
) {
  const id = validateHabitId(idRaw);
  const habit = await repo.findByIdForUsuario(id, usuarioId);
  if (!habit) {
    throw new HttpError(404, 'hábito no encontrado');
  }
  return habit;
}

export async function createHabitService(
  usuarioId: number,
  body: unknown,
  repo: HabitRepository = defaultRepository,
) {
  const input = validateCreateHabitInput(body);
  return repo.createHabit(usuarioId, input.nombre, input.meta, input.frecuencia, input.tipo);
}

export async function updateHabitService(
  usuarioId: number,
  idRaw: unknown,
  body: unknown,
  repo: HabitRepository = defaultRepository,
) {
  const id = validateHabitId(idRaw);
  const fields = validateUpdateHabitInput(body);
  const habit = await repo.updateHabit(id, usuarioId, fields);
  if (!habit) {
    throw new HttpError(404, 'hábito no encontrado');
  }
  return habit;
}

export async function deleteHabitService(
  usuarioId: number,
  idRaw: unknown,
  repo: HabitRepository = defaultRepository,
) {
  const id = validateHabitId(idRaw);
  try {
    const deleted = await repo.deleteHabit(id, usuarioId);
    if (!deleted) {
      throw new HttpError(404, 'hábito no encontrado');
    }
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      throw err;
    }
    // ON DELETE RESTRICT en registros_diarios (HU-14 CA-03): no borrar historial.
    if (err && typeof err === 'object' && (err as { code?: string }).code === '23503') {
      throw new HttpError(409, 'no se puede eliminar: tiene historial registrado');
    }
    throw err;
  }
}
