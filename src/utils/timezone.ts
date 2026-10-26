// Zona horaria del usuario (D-09). Todo "día" de la app (registro diario,
// racha, progreso) es un día calendario `YYYY-MM-DD` en esta zona; los
// instantes se siguen guardando como TIMESTAMPTZ.

export const DEFAULT_TIME_ZONE = 'America/Bogota';

const SUPPORTED = new Set<string>([...Intl.supportedValuesOf('timeZone'), 'UTC']);

/** Solo nombres IANA que conoce el runtime (p. ej. `America/Bogota`). */
export function isSupportedTimeZone(tz: unknown): tz is string {
  return typeof tz === 'string' && tz.length <= 64 && SUPPORTED.has(tz);
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(tz, f);
  }
  return f;
}

function partsOf(instant: Date, tz: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of formatterFor(tz).formatToParts(instant)) {
    if (p.type !== 'literal') {
      out[p.type] = Number(p.value);
    }
  }
  return out;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Día calendario `YYYY-MM-DD` de un instante en la zona `tz`. */
export function localDay(instant: Date, tz: string): string {
  const p = partsOf(instant, tz);
  return `${p.year}-${pad(p.month!)}-${pad(p.day!)}`;
}

export function todayIn(tz: string, now: Date = new Date()): string {
  return localDay(now, tz);
}

/** Diferencia (ms) entre la hora local de `tz` y UTC en `instantMs`. */
function offsetMs(instantMs: number, tz: string): number {
  const p = partsOf(new Date(instantMs), tz);
  const asLocal = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
  return asLocal - Math.floor(instantMs / 1000) * 1000;
}

/** Instante correspondiente a `day` + `time` (`HH:MM:SS[.mmm]`) locales en `tz`. */
export function zonedInstant(day: string, time: string, tz: string): Date {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const [hh, mi, ss] = time.split(':') as [string, string, string];
  const [sec, ms = '0'] = ss.split('.') as [string, string?];
  const asUtc = Date.UTC(y, m - 1, d, Number(hh), Number(mi), Number(sec), Number(ms));
  let instant = asUtc - offsetMs(asUtc, tz);
  // Segunda pasada por si el offset cambia entre ambos instantes (DST).
  instant = asUtc - offsetMs(instant, tz);
  return new Date(instant);
}
