import bcrypt from 'bcrypt';
import {
  findByCorreo,
  findById,
  updatePassword,
  updateProfile,
} from '../repositories/userRepository';
import { toPublicUser, type UserPublic } from '../models/user';
import { HttpError } from '../utils/httpError';
import { validateChangePasswordInput, validateUpdateProfileInput } from '../utils/validation';
import { signToken } from './authService';

// Mismo costo que el registro (authService) para no mezclar parámetros.
const BCRYPT_ROUNDS = 10;

function isUniqueViolation(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { code?: string }).code === '23505';
}

/**
 * PATCH /api/users/me. El usuario sale siempre del token, nunca del cuerpo.
 * Devuelve un token nuevo porque el correo viaja dentro del JWT.
 */
export async function updateProfileService(
  usuarioId: number,
  body: unknown,
): Promise<{ usuario: UserPublic; token: string }> {
  const input = validateUpdateProfileInput(body);
  if (input.correo !== undefined) {
    const owner = await findByCorreo(input.correo);
    if (owner && owner.id !== usuarioId) {
      throw new HttpError(409, 'correo ya registrado');
    }
  }
  try {
    const user = await updateProfile(usuarioId, input);
    if (!user) {
      throw new HttpError(404, 'usuario no encontrado');
    }
    return { usuario: toPublicUser(user), token: signToken(user) };
  } catch (err) {
    // Carrera: otro usuario tomó el correo entre la consulta y la escritura.
    if (isUniqueViolation(err)) {
      throw new HttpError(409, 'correo ya registrado');
    }
    throw err;
  }
}

/**
 * PATCH /api/users/me/password. Verifica la contraseña actual con bcrypt,
 * guarda el nuevo hash e incrementa token_version: los tokens emitidos antes
 * dejan de ser válidos y se devuelve uno nuevo para esta sesión.
 */
export async function changePasswordService(
  usuarioId: number,
  body: unknown,
): Promise<{ mensaje: string; token: string }> {
  const input = validateChangePasswordInput(body);
  const user = await findById(usuarioId);
  if (!user) {
    throw new HttpError(404, 'usuario no encontrado');
  }
  if (!(await bcrypt.compare(input.actual, user.password_hash))) {
    // 403 y no 401: la sesión es válida, lo que falla es la verificación.
    throw new HttpError(403, 'contraseña actual incorrecta');
  }
  const updated = await updatePassword(usuarioId, await bcrypt.hash(input.nueva, BCRYPT_ROUNDS));
  if (!updated) {
    throw new HttpError(404, 'usuario no encontrado');
  }
  return { mensaje: 'contraseña actualizada', token: signToken(updated) };
}
