import {
  createReminder,
  deleteReminder,
  findAllByUsuario,
  findByIdForUsuario,
  updateReminder,
  type Reminder,
} from '../repositories/reminderRepository';
import { findByIdForUsuario as findHabit } from '../repositories/habitRepository';
import { HttpError } from '../utils/httpError';
import {
  validateCreateReminderInput,
  validateId,
  validateUpdateReminderInput,
} from '../utils/validation';

// D-12: el backend solo persiste la hora; las notificaciones las programa
// el cliente (notificaciones locales). Sin push en esta versión.

const DUPLICADO = 'ya existe un recordatorio para ese hábito a esa hora';

function isUniqueViolation(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { code?: string }).code === '23505';
}

export async function listReminders(usuarioId: number): Promise<Reminder[]> {
  return findAllByUsuario(usuarioId);
}

export async function createReminderService(usuarioId: number, body: unknown): Promise<Reminder> {
  const input = validateCreateReminderInput(body);
  const habit = await findHabit(input.habitoId, usuarioId);
  if (!habit) {
    throw new HttpError(404, 'hábito no encontrado');
  }
  if (!habit.activo) {
    throw new HttpError(409, 'hábito archivado: no admite recordatorios');
  }
  try {
    const id = await createReminder(usuarioId, input.habitoId, input.hora, input.activo);
    return (await findByIdForUsuario(id, usuarioId))!;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new HttpError(409, DUPLICADO);
    }
    throw err;
  }
}

export async function updateReminderService(usuarioId: number, idRaw: unknown, body: unknown): Promise<Reminder> {
  const id = validateId(idRaw, 'id de recordatorio');
  const fields = validateUpdateReminderInput(body);
  try {
    if (!(await updateReminder(id, usuarioId, fields))) {
      throw new HttpError(404, 'recordatorio no encontrado');
    }
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new HttpError(409, DUPLICADO);
    }
    throw err;
  }
  return (await findByIdForUsuario(id, usuarioId))!;
}

export async function deleteReminderService(usuarioId: number, idRaw: unknown): Promise<void> {
  const id = validateId(idRaw, 'id de recordatorio');
  if (!(await deleteReminder(id, usuarioId))) {
    throw new HttpError(404, 'recordatorio no encontrado');
  }
}
