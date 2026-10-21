import {
  findActiveHabitsByUsuario as repoFindHabits,
  findRecordDaysByUsuario as repoFindRecordDays,
  findStreaksByUsuario as repoFindStreaks,
  type DayRecordRow,
  type HabitScheduleRow,
  type HabitStreakRow,
} from '../repositories/progressRepository';
import { getUserPoints as defaultGetUserPoints } from './pointService';
import type { UserPoints } from '../models/pointMovement';
import { HttpError } from '../utils/httpError';
import {
  addDays,
  eachDay,
  isScheduled,
  parseFrecuencia,
  percent,
  resolveReferenceDay,
} from './progressService';

export type EstadoHoy = 'cumplido' | 'no_cumplido' | 'pendiente';

export interface HabitoHoy {
  habito_id: number;
  nombre: string;
  meta: string;
  estado: EstadoHoy;
  /** Id del registro de hoy (sirve para desmarcar); null si está pendiente. */
  registro_id: number | null;
}

export interface MapaCalorDia {
  fecha: string;
  /** Hábitos que tocaban ese día (y ya existían). */
  programados: number;
  /** De esos, los que se cumplieron. */
  cumplidos: number;
  /** 0 = nada; 1–4 = proporción cumplida, para colorear el mapa de calor. */
  intensidad: number;
}

export interface RachaHabito {
  habito_id: number;
  nombre: string;
  racha_actual: number;
  racha_maxima: number;
  /** Sigue viva: no se ha dejado pasar un día programado sin cumplir. */
  activa: boolean;
}

export interface Dashboard {
  fecha: string;
  hoy: {
    programados: number;
    cumplidos: number;
    porcentaje: number;
    habitos: HabitoHoy[];
  };
  puntos: UserPoints;
  rachas: {
    /** Racha activa más larga entre los hábitos; null si no hay ninguna. */
    activa_mas_larga: { habito_id: number; nombre: string; dias: number } | null;
    /** Racha máxima histórica entre los hábitos; null si no hay ninguna. */
    maxima: { habito_id: number; nombre: string; dias: number } | null;
    por_habito: RachaHabito[];
  };
  mapa_calor: MapaCalorDia[];
}

export function intensity(programados: number, cumplidos: number): number {
  if (programados === 0 || cumplidos === 0) {
    return 0;
  }
  return Math.min(4, Math.ceil((4 * cumplidos) / programados));
}

/** ¿Algún día programado entre el último cumplido y ayer quedó sin marcar? */
export function isStreakActive(
  habit: Pick<HabitStreakRow, 'frecuencia' | 'racha_actual' | 'ultimo_cumplido_dia'>,
  ref: string,
): boolean {
  if (habit.racha_actual <= 0 || habit.ultimo_cumplido_dia === null) {
    return false;
  }
  const schedule = parseFrecuencia(habit.frecuencia);
  if (habit.ultimo_cumplido_dia >= ref) {
    return true;
  }
  for (let d = addDays(habit.ultimo_cumplido_dia, 1), n = 0; d < ref; d = addDays(d, 1), n += 1) {
    if (n > 400) {
      return false;
    }
    if (isScheduled(schedule, d)) {
      return false;
    }
  }
  return true;
}

/** Pura: arma el dashboard con los datos ya leídos. */
export function buildDashboard(input: {
  ref: string;
  semanas: number;
  habitos: ReadonlyArray<HabitScheduleRow>;
  registros: ReadonlyArray<DayRecordRow>;
  rachas: ReadonlyArray<HabitStreakRow>;
  puntos: UserPoints;
}): Dashboard {
  const { ref, habitos, registros, rachas, puntos } = input;
  const porHabitoDia = new Map<string, DayRecordRow>();
  for (const r of registros) {
    porHabitoDia.set(`${r.habito_id}|${r.dia}`, r);
  }
  const schedules = new Map<number, ReadonlySet<number> | null>(
    habitos.map((h) => [h.id, parseFrecuencia(h.frecuencia)]),
  );

  // Un hábito cuenta un día si toca ese día de la semana y ya existía
  // (o tiene un registro ese día).
  const cuenta = (h: HabitScheduleRow, dia: string): DayRecordRow | 'sin' | null => {
    if (!isScheduled(schedules.get(h.id) ?? null, dia)) {
      return null;
    }
    const rec = porHabitoDia.get(`${h.id}|${dia}`);
    if (rec) {
      return rec;
    }
    return dia >= h.creado_dia ? 'sin' : null;
  };

  const desde = addDays(ref, -(input.semanas * 7 - 1));
  const mapa: MapaCalorDia[] = eachDay(desde, ref).map((fecha) => {
    let programados = 0;
    let cumplidos = 0;
    for (const h of habitos) {
      const c = cuenta(h, fecha);
      if (c === null) {
        continue;
      }
      programados += 1;
      if (c !== 'sin' && c.cumplido) {
        cumplidos += 1;
      }
    }
    return { fecha, programados, cumplidos, intensidad: intensity(programados, cumplidos) };
  });

  const hoyHabitos: HabitoHoy[] = [];
  for (const h of habitos) {
    const c = cuenta(h, ref);
    if (c === null) {
      continue;
    }
    hoyHabitos.push({
      habito_id: h.id,
      nombre: h.nombre,
      meta: h.meta,
      estado: c === 'sin' ? 'pendiente' : c.cumplido ? 'cumplido' : 'no_cumplido',
      registro_id: c === 'sin' ? null : c.id,
    });
  }
  const hoyCumplidos = hoyHabitos.filter((h) => h.estado === 'cumplido').length;

  const porHabito: RachaHabito[] = rachas.map((r) => ({
    habito_id: r.habito_id,
    nombre: r.nombre,
    racha_actual: r.racha_actual,
    racha_maxima: r.racha_maxima,
    activa: isStreakActive(r, ref),
  }));
  let activaMasLarga: Dashboard['rachas']['activa_mas_larga'] = null;
  let maxima: Dashboard['rachas']['maxima'] = null;
  for (const r of porHabito) {
    if (r.activa && (activaMasLarga === null || r.racha_actual > activaMasLarga.dias)) {
      activaMasLarga = { habito_id: r.habito_id, nombre: r.nombre, dias: r.racha_actual };
    }
    if (r.racha_maxima > 0 && (maxima === null || r.racha_maxima > maxima.dias)) {
      maxima = { habito_id: r.habito_id, nombre: r.nombre, dias: r.racha_maxima };
    }
  }

  return {
    fecha: ref,
    hoy: {
      programados: hoyHabitos.length,
      cumplidos: hoyCumplidos,
      porcentaje: percent(hoyCumplidos, hoyHabitos.length),
      habitos: hoyHabitos,
    },
    puntos,
    rachas: { activa_mas_larga: activaMasLarga, maxima, por_habito: porHabito },
    mapa_calor: mapa,
  };
}

export interface DashboardDependencies {
  findHabits: (usuarioId: number) => Promise<HabitScheduleRow[]>;
  findRecordDays: (usuarioId: number, desde: string, hasta: string) => Promise<DayRecordRow[]>;
  findStreaks: (usuarioId: number) => Promise<HabitStreakRow[]>;
  getPoints: (usuarioId: number) => Promise<UserPoints>;
  now: () => Date;
}

const defaultDependencies: DashboardDependencies = {
  findHabits: repoFindHabits,
  findRecordDays: repoFindRecordDays,
  findStreaks: repoFindStreaks,
  getPoints: defaultGetUserPoints,
  now: () => new Date(),
};

const SEMANAS_POR_DEFECTO = 12;
const SEMANAS_MAX = 26;

export function parseSemanas(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') {
    return SEMANAS_POR_DEFECTO;
  }
  const n = typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isInteger(n) || n < 1 || n > SEMANAS_MAX) {
    throw new HttpError(400, `semanas inválido: entero entre 1 y ${SEMANAS_MAX}`);
  }
  return n;
}

/** HAB-36: datos agregados del dashboard / pantalla de inicio. */
export async function getDashboard(
  usuarioId: number,
  params: { fecha?: unknown; semanas?: unknown },
  deps: DashboardDependencies = defaultDependencies,
): Promise<Dashboard> {
  const ref = resolveReferenceDay(params.fecha, deps.now());
  const semanas = parseSemanas(params.semanas);
  const desde = addDays(ref, -(semanas * 7 - 1));
  const [habitos, registros, rachas, puntos] = await Promise.all([
    deps.findHabits(usuarioId),
    deps.findRecordDays(usuarioId, desde, ref),
    deps.findStreaks(usuarioId),
    deps.getPoints(usuarioId),
  ]);
  return buildDashboard({ ref, semanas, habitos, registros, rachas, puntos });
}
