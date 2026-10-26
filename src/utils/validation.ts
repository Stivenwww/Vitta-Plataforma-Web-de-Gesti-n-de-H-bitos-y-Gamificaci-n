import { HttpError } from './httpError';
import { localDay, todayIn, zonedInstant } from './timezone';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NOMBRE_MAX = 100;
const CORREO_MAX = 254;
// bcrypt solo usa los primeros 72 bytes: más largo daría una falsa sensación
// de seguridad.
const PASSWORD_MAX_BYTES = 72;

function asObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'datos inválidos');
  }
  return body as Record<string, unknown>;
}

export function validateNombre(nombre: unknown): string {
  if (typeof nombre !== 'string' || nombre.trim().length === 0 || nombre.trim().length > NOMBRE_MAX) {
    throw new HttpError(400, 'nombre inválido');
  }
  return nombre.trim();
}

/** Normaliza el correo: sin espacios y en minúsculas. */
export function validateCorreo(correo: unknown): string {
  if (typeof correo !== 'string' || correo.trim().length > CORREO_MAX || !EMAIL_RE.test(correo.trim())) {
    throw new HttpError(400, 'correo inválido');
  }
  return correo.trim().toLowerCase();
}

export function validatePassword(password: unknown): string {
  if (typeof password !== 'string' || password.length < 8) {
    throw new HttpError(400, 'contraseña inválida: mínimo 8 caracteres');
  }
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
    throw new HttpError(400, 'contraseña inválida: máximo 72 bytes');
  }
  return password;
}

export interface RegisterInput {
  nombre: string;
  correo: string;
  password: string;
}

export function validateRegisterInput(body: unknown): RegisterInput {
  const b = asObject(body);
  return {
    nombre: validateNombre(b.nombre),
    correo: validateCorreo(b.correo),
    password: validatePassword(b.password),
  };
}

export interface LoginInput {
  correo: string;
  password: string;
}

export function validateLoginInput(body: unknown): LoginInput {
  const b = asObject(body);
  if (typeof b.correo !== 'string' || b.correo.trim().length === 0) {
    throw new HttpError(400, 'correo inválido');
  }
  if (typeof b.password !== 'string' || b.password.length === 0) {
    throw new HttpError(400, 'contraseña inválida');
  }
  return { correo: b.correo.trim(), password: b.password };
}

// ---------------------------------------------------------------------------
// Perfil (PATCH /api/users/me y /me/password)
// ---------------------------------------------------------------------------

export interface UpdateProfileInput {
  nombre?: string;
  correo?: string;
}

export function validateUpdateProfileInput(body: unknown): UpdateProfileInput {
  const b = asObject(body);
  const out: UpdateProfileInput = {};
  if (b.nombre !== undefined) {
    out.nombre = validateNombre(b.nombre);
  }
  if (b.correo !== undefined) {
    out.correo = validateCorreo(b.correo);
  }
  if (Object.keys(out).length === 0) {
    throw new HttpError(400, 'nada para actualizar');
  }
  return out;
}

export interface ChangePasswordInput {
  actual: string;
  nueva: string;
}

export function validateChangePasswordInput(body: unknown): ChangePasswordInput {
  const b = asObject(body);
  if (typeof b.contrasena_actual !== 'string' || b.contrasena_actual.length === 0) {
    throw new HttpError(400, 'contrasena_actual requerida');
  }
  const nueva = validatePassword(b.contrasena_nueva);
  if (nueva === b.contrasena_actual) {
    throw new HttpError(400, 'la contraseña nueva debe ser distinta de la actual');
  }
  return { actual: b.contrasena_actual, nueva };
}

// ---------------------------------------------------------------------------
// Hábitos
// ---------------------------------------------------------------------------

export type HabitTipoInput = 'predefinido' | 'personalizado';

export function validateHabitId(id: unknown): number {
  const n = typeof id === 'string' ? Number(id) : id;
  if (typeof n !== 'number' || !Number.isInteger(n) || n <= 0 || n > 2147483647) {
    throw new HttpError(400, 'id de hábito inválido');
  }
  return n;
}

function validateHabitText(value: unknown, campo: string, max: number): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > max) {
    throw new HttpError(400, `${campo} inválido`);
  }
  return value.trim();
}

/** Texto opcional: `null` o `''` lo borran; sin caracteres de control. */
function validateOptionalText(value: unknown, campo: string, max: number): string | null {
  if (value === null || value === '') {
    return null;
  }
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.trim().length > max ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new HttpError(400, `${campo} inválido`);
  }
  return value.trim();
}

function validateMetaValor(value: unknown): number | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1_000_000) {
    throw new HttpError(400, 'meta_valor inválido: número mayor que 0');
  }
  return value;
}

export function validateHabitTipo(tipo: unknown): HabitTipoInput {
  if (tipo === undefined || tipo === null || tipo === '') {
    return 'personalizado';
  }
  if (tipo === 'predefinido' || tipo === 'personalizado') {
    return tipo;
  }
  throw new HttpError(400, 'tipo de hábito inválido');
}

/** Campos opcionales del hábito (D-10). El icono puede ser una clave o un emoji. */
export interface HabitExtraFields {
  categoria?: string | null;
  icono?: string | null;
  meta_valor?: number | null;
  unidad?: string | null;
}

function validateHabitExtras(b: Record<string, unknown>): HabitExtraFields {
  const out: HabitExtraFields = {};
  if (b.categoria !== undefined) {
    out.categoria = validateOptionalText(b.categoria, 'categoria', 50);
  }
  if (b.icono !== undefined) {
    out.icono = validateOptionalText(b.icono, 'icono', 64);
  }
  if (b.meta_valor !== undefined) {
    out.meta_valor = validateMetaValor(b.meta_valor);
  }
  if (b.unidad !== undefined) {
    out.unidad = validateOptionalText(b.unidad, 'unidad', 30);
  }
  return out;
}

export interface CreateHabitInput extends HabitExtraFields {
  nombre: string;
  meta: string;
  frecuencia: string;
  tipo: HabitTipoInput;
}

export function validateCreateHabitInput(body: unknown): CreateHabitInput {
  const b = asObject(body);
  return {
    nombre: validateHabitText(b.nombre, 'nombre', 100),
    meta: validateHabitText(b.meta, 'meta', 200),
    frecuencia: validateHabitText(b.frecuencia, 'frecuencia', 100),
    tipo: validateHabitTipo(b.tipo),
    ...validateHabitExtras(b),
  };
}

export interface UpdateHabitInput extends HabitExtraFields {
  nombre?: string;
  meta?: string;
  frecuencia?: string;
}

/** Actualización parcial: solo cambian los campos enviados. */
export function validateUpdateHabitInput(body: unknown): UpdateHabitInput {
  const b = asObject(body);
  const out: UpdateHabitInput = {};
  if (b.nombre !== undefined) {
    out.nombre = validateHabitText(b.nombre, 'nombre', 100);
  }
  if (b.meta !== undefined) {
    out.meta = validateHabitText(b.meta, 'meta', 200);
  }
  if (b.frecuencia !== undefined) {
    out.frecuencia = validateHabitText(b.frecuencia, 'frecuencia', 100);
  }
  Object.assign(out, validateHabitExtras(b));
  if (Object.keys(out).length === 0) {
    throw new HttpError(400, 'nada para actualizar');
  }
  return out;
}

// ---------------------------------------------------------------------------
// Registros diarios
// ---------------------------------------------------------------------------

// HU-15 (D-07, D-09): `fecha` acepta ISO 8601 —día `YYYY-MM-DD` o fecha-hora
// `YYYY-MM-DDTHH:mm:ss[.sss][Z|±hh:mm]`—. El servidor deriva el día local
// (`dia`) en la zona del usuario. Una fecha-hora sin offset se interpreta
// como hora local de esa zona. Nunca texto libre ni AM/PM.
const FECHA_DIA_RE = /^\d{4}-\d{2}-\d{2}$/;
const FECHA_HORA_RE =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:?\d{2})?$/;
const FECHA_MSG = 'fecha inválida: use ISO 8601 (YYYY-MM-DD o YYYY-MM-DDTHH:mm:ssZ)';
const FECHA_MIN = '2000-01-01';

// Tolerancia de 60 s para relojes de cliente ligeramente adelantados.
const FUTURE_SKEW_MS = 60_000;

/** Valida un día `YYYY-MM-DD` real (rechaza 2026-02-30). */
export function parseDiaCalendario(raw: string, campo = 'fecha'): string {
  if (!FECHA_DIA_RE.test(raw)) {
    throw new HttpError(400, `${campo} inválida: use YYYY-MM-DD`);
  }
  const d = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw) {
    throw new HttpError(400, `${campo} inválida`);
  }
  return raw;
}

export interface RecordFecha {
  /** Instante ISO 8601 UTC. */
  fecha: string;
  /** Día local `YYYY-MM-DD` en la zona del usuario. */
  dia: string;
}

export function validateRecordFecha(fecha: unknown, tz: string, now: Date = new Date()): RecordFecha {
  const hoy = todayIn(tz, now);
  if (fecha === undefined || fecha === null || fecha === '') {
    return { fecha: now.toISOString(), dia: hoy };
  }
  if (typeof fecha !== 'string') {
    throw new HttpError(400, FECHA_MSG);
  }
  const raw = fecha.trim();
  let instant: Date;
  let dia: string;
  if (FECHA_DIA_RE.test(raw)) {
    dia = parseDiaCalendario(raw);
    // Hoy → el instante real; un día pasado → mediodía local de ese día.
    instant = dia === hoy ? now : zonedInstant(dia, '12:00:00', tz);
  } else {
    const m = FECHA_HORA_RE.exec(raw);
    if (!m) {
      throw new HttpError(400, FECHA_MSG);
    }
    const [, y, mo, d, h, mi, s = '00', ms = '0', zone] = m;
    parseDiaCalendario(`${y}-${mo}-${d}`);
    if (Number(h) > 23 || Number(mi) > 59 || Number(s) > 59) {
      throw new HttpError(400, FECHA_MSG);
    }
    instant = zone
      ? new Date(raw.replace(' ', 'T'))
      : zonedInstant(`${y}-${mo}-${d}`, `${h}:${mi}:${s}.${ms.padEnd(3, '0')}`, tz);
    if (Number.isNaN(instant.getTime())) {
      throw new HttpError(400, FECHA_MSG);
    }
    dia = localDay(instant, tz);
  }
  if (dia > hoy || instant.getTime() > now.getTime() + FUTURE_SKEW_MS) {
    throw new HttpError(400, 'fecha inválida: no puede ser futura');
  }
  if (dia < FECHA_MIN) {
    throw new HttpError(400, 'fecha inválida: demasiado antigua');
  }
  return { fecha: instant.toISOString(), dia };
}

export function validateCumplido(cumplido: unknown): boolean {
  if (typeof cumplido !== 'boolean') {
    throw new HttpError(400, 'cumplido inválido: debe ser booleano');
  }
  return cumplido;
}

export function validateValor(valor: unknown): number | null {
  if (valor === undefined || valor === null) {
    return null;
  }
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0 || valor > 1_000_000) {
    throw new HttpError(400, 'valor inválido: número entre 0 y 1000000');
  }
  return valor;
}

const NOTAS_MAX = 1000;

/** `undefined` = no tocar las notas; `null` o `''` = borrarlas. */
export function validateNotas(notas: unknown): string | null | undefined {
  if (notas === undefined) {
    return undefined;
  }
  if (notas === null) {
    return null;
  }
  if (typeof notas !== 'string') {
    throw new HttpError(400, 'notas inválidas: debe ser texto');
  }
  if (notas.length > NOTAS_MAX) {
    throw new HttpError(400, `notas inválidas: máximo ${NOTAS_MAX} caracteres`);
  }
  return notas.trim() === '' ? null : notas;
}

export interface CreateRecordInput extends RecordFecha {
  cumplido: boolean;
  valor: number | null;
  notas: string | null;
}

export function validateCreateRecordInput(body: unknown, tz: string, now: Date = new Date()): CreateRecordInput {
  const b = asObject(body);
  return {
    ...validateRecordFecha(b.fecha, tz, now),
    cumplido: validateCumplido(b.cumplido),
    valor: validateValor(b.valor),
    notas: validateNotas(b.notas) ?? null,
  };
}

export interface ProgressInput extends RecordFecha {
  valor: number;
  notas: string | null | undefined;
}

/** PATCH /api/habits/:id/progreso → `{ valor, fecha?, notas? }`. */
export function validateProgressInput(body: unknown, tz: string, now: Date = new Date()): ProgressInput {
  const b = asObject(body);
  const valor = validateValor(b.valor);
  if (valor === null) {
    throw new HttpError(400, 'valor requerido');
  }
  return { ...validateRecordFecha(b.fecha, tz, now), valor, notas: validateNotas(b.notas) };
}

// ---------------------------------------------------------------------------
// Recordatorios
// ---------------------------------------------------------------------------

const HORA_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::00)?$/;

/** Hora local `HH:MM` (24 h); se acepta `HH:MM:00`. */
export function validateHora(hora: unknown): string {
  if (typeof hora !== 'string' || !HORA_RE.test(hora.trim())) {
    throw new HttpError(400, 'hora inválida: use HH:MM (24 h)');
  }
  return hora.trim().slice(0, 5);
}

export function validateId(id: unknown, campo: string): number {
  const n = typeof id === 'string' && /^\d+$/.test(id) ? Number(id) : id;
  if (typeof n !== 'number' || !Number.isInteger(n) || n <= 0 || n > 2147483647) {
    throw new HttpError(400, `${campo} inválido`);
  }
  return n;
}

export interface CreateReminderInput {
  habitoId: number;
  hora: string;
  activo: boolean;
}

export function validateCreateReminderInput(body: unknown): CreateReminderInput {
  const b = asObject(body);
  if (b.activo !== undefined && typeof b.activo !== 'boolean') {
    throw new HttpError(400, 'activo inválido: debe ser booleano');
  }
  return {
    habitoId: validateId(b.habito_id, 'habito_id'),
    hora: validateHora(b.hora),
    activo: b.activo === undefined ? true : (b.activo as boolean),
  };
}

export interface UpdateReminderInput {
  hora?: string;
  activo?: boolean;
}

export function validateUpdateReminderInput(body: unknown): UpdateReminderInput {
  const b = asObject(body);
  const out: UpdateReminderInput = {};
  if (b.hora !== undefined) {
    out.hora = validateHora(b.hora);
  }
  if (b.activo !== undefined) {
    if (typeof b.activo !== 'boolean') {
      throw new HttpError(400, 'activo inválido: debe ser booleano');
    }
    out.activo = b.activo;
  }
  if (Object.keys(out).length === 0) {
    throw new HttpError(400, 'nada para actualizar');
  }
  return out;
}
