import { HttpError } from './httpError';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateNombre(nombre: unknown): string {
  if (typeof nombre !== 'string' || nombre.trim().length === 0) {
    throw new HttpError(400, 'nombre inválido');
  }
  return nombre.trim();
}

export function validateCorreo(correo: unknown): string {
  if (typeof correo !== 'string' || !EMAIL_RE.test(correo.trim())) {
    throw new HttpError(400, 'correo inválido');
  }
  return correo.trim();
}

export function validatePassword(password: unknown): string {
  if (typeof password !== 'string' || password.length < 8) {
    throw new HttpError(400, 'contraseña inválida: mínimo 8 caracteres');
  }
  return password;
}

export interface RegisterInput {
  nombre: string;
  correo: string;
  password: string;
}

export function validateRegisterInput(body: unknown): RegisterInput {
  if (!body || typeof body !== 'object') {
    throw new HttpError(400, 'datos inválidos');
  }
  const b = body as Record<string, unknown>;
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
  if (!body || typeof body !== 'object') {
    throw new HttpError(400, 'datos inválidos');
  }
  const b = body as Record<string, unknown>;
  if (typeof b.correo !== 'string' || b.correo.trim().length === 0) {
    throw new HttpError(400, 'correo inválido');
  }
  if (typeof b.password !== 'string' || b.password.length === 0) {
    throw new HttpError(400, 'contraseña inválida');
  }
  return { correo: b.correo.trim(), password: b.password };
}

export type HabitTipoInput = 'predefinido' | 'personalizado';

export function validateHabitId(id: unknown): number {
  const n = typeof id === 'string' ? Number(id) : id;
  if (typeof n !== 'number' || !Number.isInteger(n) || n <= 0) {
    throw new HttpError(400, 'id de hábito inválido');
  }
  return n;
}

function validateHabitText(value: unknown, campo: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpError(400, `${campo} inválido`);
  }
  return value.trim();
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

export interface CreateHabitInput {
  nombre: string;
  meta: string;
  frecuencia: string;
  tipo: HabitTipoInput;
}

export function validateCreateHabitInput(body: unknown): CreateHabitInput {
  if (!body || typeof body !== 'object') {
    throw new HttpError(400, 'datos inválidos');
  }
  const b = body as Record<string, unknown>;
  return {
    nombre: validateHabitText(b.nombre, 'nombre'),
    meta: validateHabitText(b.meta, 'meta'),
    frecuencia: validateHabitText(b.frecuencia, 'frecuencia'),
    tipo: validateHabitTipo(b.tipo),
  };
}

export interface UpdateHabitInput {
  nombre?: string;
  meta?: string;
  frecuencia?: string;
}

export function validateUpdateHabitInput(body: unknown): UpdateHabitInput {
  if (!body || typeof body !== 'object') {
    throw new HttpError(400, 'datos inválidos');
  }
  const b = body as Record<string, unknown>;
  const out: UpdateHabitInput = {};
  if (b.nombre !== undefined) {
    out.nombre = validateHabitText(b.nombre, 'nombre');
  }
  if (b.meta !== undefined) {
    out.meta = validateHabitText(b.meta, 'meta');
  }
  if (b.frecuencia !== undefined) {
    out.frecuencia = validateHabitText(b.frecuencia, 'frecuencia');
  }
  if (Object.keys(out).length === 0) {
    throw new HttpError(400, 'nada para actualizar');
  }
  return out;
}

// HU-15 (D-07): fechas en UTC con tipo temporal nativo (TIMESTAMPTZ).
// Se acepta ISO 8601 —día `YYYY-MM-DD` (compatibilidad) o fecha-hora
// completa `YYYY-MM-DDTHH:mm:ss[.sss][Z|±hh:mm]`— y siempre se normaliza
// a UTC con `toISOString()` (ej. `2026-09-11T04:55:32.000Z`). Nunca se
// acepta ni se almacena texto libre ni AM/PM; la zona horaria se resuelve
// en presentación.
const FECHA_DIA_RE = /^\d{4}-\d{2}-\d{2}$/;
const FECHA_HORA_RE =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})?$/;

// Tolerancia de 60 s para relojes de cliente ligeramente adelantados.
const FUTURE_SKEW_MS = 60_000;

function parseDiaCalendario(raw: string): Date {
  const [y, m, day] = raw.split('-').map(Number);
  const d = new Date(Date.UTC(y as number, (m as number) - 1, day as number));
  if (
    d.getUTCFullYear() !== y ||
    d.getUTCMonth() !== (m as number) - 1 ||
    d.getUTCDate() !== day
  ) {
    throw new HttpError(400, 'fecha inválida');
  }
  return d;
}

export function validateRecordFecha(fecha: unknown): string {
  if (fecha === undefined || fecha === null || fecha === '') {
    return new Date().toISOString();
  }
  if (typeof fecha !== 'string') {
    throw new HttpError(400, 'fecha inválida: use ISO 8601 (YYYY-MM-DD o YYYY-MM-DDTHH:mm:ssZ)');
  }
  const raw = fecha.trim();
  let d: Date;
  if (FECHA_DIA_RE.test(raw)) {
    // Día sin hora: medianoche UTC de ese día.
    d = parseDiaCalendario(raw);
  } else if (FECHA_HORA_RE.test(raw)) {
    // Sin offset explícito se interpreta como UTC (se añade Z) para no
    // depender de la zona horaria del servidor.
    const withZone = /[Zz]|[+-]\d{2}:?\d{2}$/.test(raw) ? raw : `${raw.replace(' ', 'T')}Z`;
    d = new Date(withZone);
    if (Number.isNaN(d.getTime())) {
      throw new HttpError(400, 'fecha inválida: use ISO 8601 (YYYY-MM-DD o YYYY-MM-DDTHH:mm:ssZ)');
    }
  } else {
    throw new HttpError(400, 'fecha inválida: use ISO 8601 (YYYY-MM-DD o YYYY-MM-DDTHH:mm:ssZ)');
  }
  if (d.getTime() > Date.now() + FUTURE_SKEW_MS) {
    throw new HttpError(400, 'fecha inválida: no puede ser futura');
  }
  return d.toISOString();
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
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    throw new HttpError(400, 'valor inválido: debe ser numérico');
  }
  return valor;
}

export interface CreateRecordInput {
  fecha: string;
  cumplido: boolean;
  valor: number | null;
}

export function validateCreateRecordInput(body: unknown): CreateRecordInput {
  if (!body || typeof body !== 'object') {
    throw new HttpError(400, 'datos inválidos');
  }
  const b = body as Record<string, unknown>;
  return {
    fecha: validateRecordFecha(b.fecha),
    cumplido: validateCumplido(b.cumplido),
    valor: validateValor(b.valor),
  };
}
