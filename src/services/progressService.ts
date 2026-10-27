import { findByIdForUsuario as repoFindHabit } from '../repositories/habitRepository';
import {
  findCalendarHabitsByUsuario as repoFindCalendarHabits,
  findRecordDaysByHabit as repoFindRecordDays,
  findRecordDaysByUsuario as repoFindUserRecordDays,
  type DayRecordRow,
  type HabitCalendarRow,
} from '../repositories/progressRepository';
import type { Habit } from '../models/habit';
import { HttpError } from '../utils/httpError';
import { validateHabitId } from '../utils/validation';
import { localDay, todayIn } from '../utils/timezone';

// ---------------------------------------------------------------------------
// Utilidades de fechas: días calendario locales del usuario (`YYYY-MM-DD`,
// D-09). La aritmética sobre estas cadenas no depende de la zona. Puras.
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
const DIA_RE = /^\d{4}-\d{2}-\d{2}$/;

export function addDays(day: string, n: number): string {
  return new Date(new Date(`${day}T00:00:00Z`).getTime() + n * DAY_MS).toISOString().slice(0, 10);
}

/** Día de la semana ISO: 1 = lunes … 7 = domingo. */
export function isoWeekday(day: string): number {
  const d = new Date(`${day}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Valida un día `YYYY-MM-DD` real (rechaza 2026-02-30). */
export function parseDia(raw: unknown, campo = 'fecha'): string {
  if (typeof raw !== 'string' || !DIA_RE.test(raw.trim())) {
    throw new HttpError(400, `${campo} inválida: use YYYY-MM-DD`);
  }
  const day = raw.trim();
  const d = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== day) {
    throw new HttpError(400, `${campo} inválida`);
  }
  return day;
}

/**
 * Día de referencia. Si el cliente no lo manda, hoy en la zona del usuario.
 * Se tolera un día por delante (cliente con reloj o zona más adelantados);
 * más allá → 400.
 */
export function resolveReferenceDay(raw: unknown, now: Date, tz: string): string {
  if (raw === undefined || raw === null || raw === '') {
    return todayIn(tz, now);
  }
  const day = parseDia(raw);
  if (day > addDays(todayIn(tz, now), 1)) {
    throw new HttpError(400, 'fecha inválida: no puede ser futura');
  }
  return day;
}

export type Periodo = 'semana' | 'mes';

export function parsePeriodo(raw: unknown): Periodo {
  if (raw === undefined || raw === null || raw === '') {
    return 'semana';
  }
  if (raw === 'semana' || raw === 'mes') {
    return raw;
  }
  throw new HttpError(400, "periodo inválido: use 'semana' o 'mes'");
}

/** Semana natural (lunes–domingo) o mes natural que contiene `ref`. */
export function periodBounds(periodo: Periodo, ref: string): { desde: string; hasta: string } {
  if (periodo === 'semana') {
    const desde = addDays(ref, -(isoWeekday(ref) - 1));
    return { desde, hasta: addDays(desde, 6) };
  }
  const [y, m] = ref.split('-').map(Number) as [number, number];
  const desde = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
  const hasta = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { desde, hasta };
}

export function eachDay(desde: string, hasta: string): string[] {
  const out: string[] = [];
  for (let d = desde; d <= hasta; d = addDays(d, 1)) {
    out.push(d);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Frecuencia: la app guarda "Diaria" o días "L,X,V" (spec v2.0 §5.2).
// ---------------------------------------------------------------------------

const LETRA_A_DIA: Record<string, number> = { L: 1, M: 2, X: 3, J: 4, V: 5, S: 6, D: 7 };

/**
 * Días de la semana (1=lunes … 7=domingo) en que toca el hábito, o `null`
 * si es diario. Cualquier texto que no sea una lista de letras L,M,X,J,V,S,D
 * (p. ej. "Diaria") se trata como diario.
 */
export function parseFrecuencia(frecuencia: string): ReadonlySet<number> | null {
  const tokens = frecuencia
    .split(/[\s,;/-]+/)
    .map((t) => t.trim().toUpperCase())
    .filter((t) => t.length > 0);
  if (tokens.length === 0 || !tokens.every((t) => t in LETRA_A_DIA)) {
    return null;
  }
  return new Set(tokens.map((t) => LETRA_A_DIA[t] as number));
}

export function isScheduled(schedule: ReadonlySet<number> | null, day: string): boolean {
  return schedule === null || schedule.has(isoWeekday(day));
}

/** Hábito con su vigencia expresada en días locales. */
export interface HabitScheduleRow {
  id: number;
  nombre: string;
  meta: string;
  frecuencia: string;
  activo: boolean;
  /** Día local en que se creó el hábito. */
  creado_dia: string;
  /** Día local en que se archivó; null si sigue activo. */
  archivado_dia: string | null;
}

export function toScheduleRows(rows: ReadonlyArray<HabitCalendarRow>, tz: string): HabitScheduleRow[] {
  return rows.map((h) => ({
    id: h.id,
    nombre: h.nombre,
    meta: h.meta,
    frecuencia: h.frecuencia,
    activo: h.activo,
    creado_dia: localDay(new Date(h.creado_en), tz),
    archivado_dia: h.archivado_en ? localDay(new Date(h.archivado_en), tz) : null,
  }));
}

/**
 * ¿El hábito "tocaba" ese día? Debe incluirlo su frecuencia y, si no hay
 * registro, el día debe estar dentro de su vigencia (desde que se creó y
 * antes de archivarse). Un registro existente siempre cuenta: es historial.
 */
export function habitDueOn(
  h: Pick<HabitScheduleRow, 'creado_dia' | 'archivado_dia'>,
  schedule: ReadonlySet<number> | null,
  dia: string,
  tieneRegistro: boolean,
): boolean {
  if (!isScheduled(schedule, dia)) {
    return false;
  }
  if (tieneRegistro) {
    return true;
  }
  return dia >= h.creado_dia && (h.archivado_dia === null || dia < h.archivado_dia);
}

// ---------------------------------------------------------------------------
// Progreso de un hábito
// ---------------------------------------------------------------------------

export type DayState = 'cumplido' | 'no_cumplido' | 'sin_registro' | 'futuro' | 'previo';

export interface ProgressDay {
  fecha: string;
  /** La frecuencia del hábito incluye este día de la semana. */
  programado: boolean;
  /**
   * cumplido / no_cumplido: hay registro. sin_registro: día pasado o de hoy
   * sin registro. futuro: después del día de referencia. previo: anterior a
   * la creación del hábito (no cuenta).
   */
  estado: DayState;
}

export interface HabitProgress {
  habito_id: number;
  periodo: Periodo;
  desde: string;
  hasta: string;
  fecha_referencia: string;
  /** Días programados del periodo que ya cuentan (hasta la referencia). */
  dias_programados: number;
  /** De esos, los cumplidos. */
  dias_cumplidos: number;
  /** 0–100, entero. 0 si aún no hay días programados que contar. */
  porcentaje: number;
  dias: ProgressDay[];
}

export function dayStateFor(
  day: string,
  ref: string,
  creadoDia: string,
  cumplido: boolean | undefined,
): DayState {
  if (day > ref) {
    return 'futuro';
  }
  if (cumplido === true) {
    return 'cumplido';
  }
  if (cumplido === undefined && day < creadoDia) {
    return 'previo';
  }
  return cumplido === false ? 'no_cumplido' : 'sin_registro';
}

export function percent(cumplidos: number, programados: number): number {
  return programados === 0 ? 0 : Math.round((cumplidos * 100) / programados);
}

/** Pura: arma el progreso a partir de los registros ya leídos. */
export function buildHabitProgress(input: {
  habitoId: number;
  frecuencia: string;
  creadoDia: string;
  periodo: Periodo;
  ref: string;
  registros: ReadonlyArray<Pick<DayRecordRow, 'dia' | 'cumplido'>>;
}): HabitProgress {
  const { desde, hasta } = periodBounds(input.periodo, input.ref);
  const schedule = parseFrecuencia(input.frecuencia);
  const porDia = new Map<string, boolean>();
  for (const r of input.registros) {
    porDia.set(r.dia, r.cumplido);
  }
  const dias: ProgressDay[] = eachDay(desde, hasta).map((fecha) => ({
    fecha,
    programado: isScheduled(schedule, fecha),
    estado: dayStateFor(fecha, input.ref, input.creadoDia, porDia.get(fecha)),
  }));
  const cuentan = dias.filter(
    (d) => d.programado && (d.estado === 'cumplido' || d.estado === 'no_cumplido' || d.estado === 'sin_registro'),
  );
  const cumplidos = cuentan.filter((d) => d.estado === 'cumplido').length;
  return {
    habito_id: input.habitoId,
    periodo: input.periodo,
    desde,
    hasta,
    fecha_referencia: input.ref,
    dias_programados: cuentan.length,
    dias_cumplidos: cumplidos,
    porcentaje: percent(cumplidos, cuentan.length),
    dias,
  };
}

export interface ProgressDependencies {
  findHabit: (id: number, usuarioId: number) => Promise<Habit | null>;
  findRecordDays: (habitoId: number, desde: string, hasta: string) => Promise<DayRecordRow[]>;
  now: () => Date;
}

const defaultDependencies: ProgressDependencies = {
  findHabit: repoFindHabit,
  findRecordDays: repoFindRecordDays,
  now: () => new Date(),
};

/** HAB-131: progreso semanal o mensual de un hábito. */
export async function getHabitProgress(
  usuarioId: number,
  habitoIdRaw: unknown,
  params: { periodo?: unknown; fecha?: unknown },
  tz: string,
  deps: ProgressDependencies = defaultDependencies,
): Promise<HabitProgress> {
  const habitoId = validateHabitId(habitoIdRaw);
  const periodo = parsePeriodo(params.periodo);
  const ref = resolveReferenceDay(params.fecha, deps.now(), tz);
  const habit = await deps.findHabit(habitoId, usuarioId);
  if (!habit) {
    throw new HttpError(404, 'hábito no encontrado');
  }
  const { desde, hasta } = periodBounds(periodo, ref);
  const registros = await deps.findRecordDays(habitoId, desde, hasta);
  return buildHabitProgress({
    habitoId,
    frecuencia: habit.frecuencia,
    // `creado_en` llega como Date en tiempo de ejecución aunque el tipo diga string.
    creadoDia: localDay(new Date(habit.creado_en), tz),
    periodo,
    ref,
    registros,
  });
}

// ---------------------------------------------------------------------------
// Progreso agregado por día (GET /api/progress?desde&hasta)
// ---------------------------------------------------------------------------

export interface DailySummary {
  fecha: string;
  /** Hábitos que tocaban ese día. */
  total: number;
  /** De esos, los cumplidos. */
  completados: number;
  /** De esos, los que tienen avance (`valor > 0`) sin estar cumplidos. */
  parciales: number;
}

/**
 * Pura: resume cada día del rango. Cada hábito cuenta como máximo una vez
 * por día (hay un único registro por hábito y día). Los días sin hábitos
 * programados salen con total 0, para que la serie sea continua.
 */
export function buildDailySummary(input: {
  desde: string;
  hasta: string;
  habitos: ReadonlyArray<HabitScheduleRow>;
  registros: ReadonlyArray<Pick<DayRecordRow, 'habito_id' | 'dia' | 'cumplido' | 'valor'>>;
}): DailySummary[] {
  const porHabitoDia = new Map<string, Pick<DayRecordRow, 'cumplido' | 'valor'>>();
  for (const r of input.registros) {
    porHabitoDia.set(`${r.habito_id}|${r.dia}`, r);
  }
  const schedules = input.habitos.map((h) => [h, parseFrecuencia(h.frecuencia)] as const);
  return eachDay(input.desde, input.hasta).map((fecha) => {
    let total = 0;
    let completados = 0;
    let parciales = 0;
    for (const [h, schedule] of schedules) {
      const rec = porHabitoDia.get(`${h.id}|${fecha}`);
      if (!habitDueOn(h, schedule, fecha, rec !== undefined)) {
        continue;
      }
      total += 1;
      if (rec?.cumplido) {
        completados += 1;
      } else if ((rec?.valor ?? 0) > 0) {
        parciales += 1;
      }
    }
    return { fecha, total, completados, parciales };
  });
}

export const RANGO_MAX_DIAS = 366;

export interface ProgressRangeDependencies {
  findHabits: (usuarioId: number) => Promise<HabitCalendarRow[]>;
  findRecordDays: (usuarioId: number, desde: string, hasta: string) => Promise<DayRecordRow[]>;
  now: () => Date;
}

const defaultRangeDependencies: ProgressRangeDependencies = {
  findHabits: repoFindCalendarHabits,
  findRecordDays: repoFindUserRecordDays,
  now: () => new Date(),
};

function dayCount(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / DAY_MS) + 1;
}

/**
 * Progreso diario de todos los hábitos del usuario en [desde, hasta] con dos
 * consultas en total (no una por hábito). Por defecto, los últimos 7 días.
 */
export async function getProgressRange(
  usuarioId: number,
  params: { desde?: unknown; hasta?: unknown },
  tz: string,
  deps: ProgressRangeDependencies = defaultRangeDependencies,
): Promise<DailySummary[]> {
  const hasta = resolveReferenceDay(params.hasta, deps.now(), tz);
  const desde =
    params.desde === undefined || params.desde === '' ? addDays(hasta, -6) : parseDia(params.desde, 'desde');
  if (desde > hasta) {
    throw new HttpError(400, 'rango inválido: desde no puede ser posterior a hasta');
  }
  if (dayCount(desde, hasta) > RANGO_MAX_DIAS) {
    throw new HttpError(400, `rango inválido: máximo ${RANGO_MAX_DIAS} días`);
  }
  const [habitos, registros] = await Promise.all([
    deps.findHabits(usuarioId),
    deps.findRecordDays(usuarioId, desde, hasta),
  ]);
  return buildDailySummary({ desde, hasta, habitos: toScheduleRows(habitos, tz), registros });
}
