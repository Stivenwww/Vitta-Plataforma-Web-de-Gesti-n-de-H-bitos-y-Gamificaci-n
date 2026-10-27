// Pruebas unitarias de reglas puras: no necesitan base de datos.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStreaks } from '../../src/services/streakService';
import { rawProgress, normalize } from '../../src/services/achievementService';
import { buildDailySummary, getProgressRange, type HabitScheduleRow } from '../../src/services/progressService';
import { validateRecordFecha, validateHora, validateCorreo, validatePassword, validateUpdateHabitInput } from '../../src/utils/validation';
import { isSupportedTimeZone, localDay, todayIn, zonedInstant } from '../../src/utils/timezone';
import { errorHandler } from '../../src/middleware/errorHandler';
import { HttpError } from '../../src/utils/httpError';

const rec = (dia: string, cumplido: boolean, valor: number | null = null) => ({ dia, cumplido, valor });

describe('zona horaria America/Bogota (D-09)', () => {
  test('20:30 en Bogotá sigue siendo el mismo día aunque en UTC ya sea el siguiente', () => {
    const now = new Date('2026-10-27T01:30:00Z'); // 26-oct 20:30 en Bogotá
    assert.equal(todayIn('America/Bogota', now), '2026-10-26');
    assert.equal(todayIn('UTC', now), '2026-10-27');
    const r = validateRecordFecha(undefined, 'America/Bogota', now);
    assert.equal(r.dia, '2026-10-26');
    assert.equal(r.fecha, now.toISOString());
  });

  test('23:59:59 local pertenece al día; 00:00 local ya es el siguiente', () => {
    assert.equal(localDay(new Date('2026-10-27T04:59:59Z'), 'America/Bogota'), '2026-10-26');
    assert.equal(localDay(new Date('2026-10-27T05:00:00Z'), 'America/Bogota'), '2026-10-27');
  });

  test('fecha-hora explícita con offset y sin offset (hora local)', () => {
    const now = new Date('2026-10-27T12:00:00Z');
    assert.equal(validateRecordFecha('2026-10-26T23:30:00-05:00', 'America/Bogota', now).dia, '2026-10-26');
    assert.equal(validateRecordFecha('2026-10-27T01:30:00Z', 'America/Bogota', now).dia, '2026-10-26');
    const sinOffset = validateRecordFecha('2026-10-26T23:30:00', 'America/Bogota', now);
    assert.equal(sinOffset.dia, '2026-10-26');
    assert.equal(sinOffset.fecha, '2026-10-27T04:30:00.000Z');
  });

  test('día explícito: hoy usa el instante real, un día pasado el mediodía local', () => {
    const now = new Date('2026-10-27T01:30:00Z');
    assert.equal(validateRecordFecha('2026-10-26', 'America/Bogota', now).fecha, now.toISOString());
    assert.equal(validateRecordFecha('2026-10-20', 'America/Bogota', now).fecha, '2026-10-20T17:00:00.000Z');
  });

  test('rechaza fechas futuras en la zona del usuario y fechas inválidas', () => {
    const now = new Date('2026-10-27T01:30:00Z'); // 26-oct en Bogotá
    assert.throws(() => validateRecordFecha('2026-10-27', 'America/Bogota', now), /futura/);
    assert.equal(validateRecordFecha('2026-10-27', 'Asia/Tokyo', now).dia, '2026-10-27');
    assert.throws(() => validateRecordFecha('2026-02-30', 'America/Bogota', now), HttpError);
    assert.throws(() => validateRecordFecha('ayer', 'America/Bogota', now), HttpError);
    assert.throws(() => validateRecordFecha('2026-10-26T25:00:00', 'America/Bogota', now), HttpError);
  });

  test('otras zonas válidas y validación del nombre IANA', () => {
    assert.equal(zonedInstant('2026-10-26', '00:00:00', 'Europe/Madrid').toISOString(), '2026-10-25T23:00:00.000Z');
    assert.equal(isSupportedTimeZone('America/Bogota'), true);
    assert.equal(isSupportedTimeZone('Europe/Madrid'), true);
    assert.equal(isSupportedTimeZone('UTC'), true);
    for (const bad of ['', 'Bogota', 'America/Nowhere', "UTC'; DROP TABLE x;--", 'x'.repeat(100)]) {
      assert.equal(isSupportedTimeZone(bad), false, bad);
    }
  });
});

describe('rachas (HU-16)', () => {
  const hoy = '2026-10-26'; // lunes

  test('CA-01: días consecutivos suman; CA-03: la máxima se conserva', () => {
    const r = [rec('2026-10-19', true), rec('2026-10-20', true), rec('2026-10-21', true), rec('2026-10-22', true),
      rec('2026-10-23', false), rec('2026-10-24', true), rec('2026-10-25', true)];
    assert.deepEqual(computeStreaks(r, 'Diaria', hoy), { actual: 2, maxima: 4 });
  });

  test('CA-02: un día pasado sin marcar deja la racha en 0', () => {
    assert.deepEqual(computeStreaks([rec('2026-10-22', true), rec('2026-10-23', true)], 'Diaria', hoy), { actual: 0, maxima: 2 });
  });

  test('hoy sin registro o con avance parcial no rompe; un "no" explícito sí', () => {
    const base = [rec('2026-10-24', true), rec('2026-10-25', true)];
    assert.equal(computeStreaks(base, 'Diaria', hoy).actual, 2);
    assert.equal(computeStreaks([...base, rec(hoy, false, 3)], 'Diaria', hoy).actual, 2);
    assert.equal(computeStreaks([...base, rec(hoy, false, null)], 'Diaria', hoy).actual, 0);
    assert.equal(computeStreaks([...base, rec(hoy, true, 8)], 'Diaria', hoy).actual, 3);
  });

  test('frecuencia L,X,V: los días no programados no cortan la racha', () => {
    const r = [rec('2026-10-19', true), rec('2026-10-21', true), rec('2026-10-23', true)]; // L, X, V
    assert.deepEqual(computeStreaks(r, 'L,X,V', hoy), { actual: 3, maxima: 3 });
    // Faltó el miércoles 21 (programado) → se reinicia.
    assert.deepEqual(computeStreaks([rec('2026-10-19', true), rec('2026-10-23', true)], 'L,X,V', hoy), { actual: 1, maxima: 1 });
  });
});

describe('logros (HU-18)', () => {
  const habitos = [
    { id: 1, nombre: 'Leer', categoria: 'Estudio', icono: 'book', unidad: 'minutos' },
    { id: 2, nombre: 'Caminata', categoria: 'Movimiento', icono: null, unidad: 'pasos' },
    { id: 3, nombre: 'Meditar', categoria: 'Bienestar', icono: 'meditate', unidad: null },
  ];
  const cumplidos = [
    { habito_id: 1, dia: '2026-10-19' }, { habito_id: 1, dia: '2026-10-20' }, { habito_id: 1, dia: '2026-10-21' },
    { habito_id: 2, dia: '2026-10-20' }, { habito_id: 2, dia: '2026-10-21' },
    { habito_id: 3, dia: '2026-10-27' },
  ];
  const facts = { habitos, cumplidos, rachaMaxima: 5 };

  test('cada criterio usa su propia regla', () => {
    assert.equal(rawProgress({ criterio: 'cumplimientos', filtro: null }, facts), 6);
    assert.equal(rawProgress({ criterio: 'cumplimientos', filtro: ['book', 'lectura'] }, facts), 3);
    assert.equal(rawProgress({ criterio: 'dias', filtro: ['pasos'] }, facts), 2);
    assert.equal(rawProgress({ criterio: 'racha', filtro: null }, facts), 5);
    // Semana del 19 al 25: Estudio + Movimiento = 2; la del 26: Bienestar = 1.
    assert.equal(rawProgress({ criterio: 'areas_semana', filtro: null }, facts), 2);
    assert.equal(rawProgress({ criterio: null, filtro: null }, facts), null);
  });

  test('normaliza tildes y mayúsculas', () => {
    assert.equal(normalize(' Alimentación '), 'alimentacion');
    assert.equal(rawProgress({ criterio: 'cumplimientos', filtro: ['movimiento'] }, {
      ...facts, habitos: [{ ...habitos[1]!, categoria: 'MOVIMIENTO' }],
    }), 2);
  });
});

describe('progreso agregado', () => {
  const h = (id: number, frecuencia: string, creado: string, archivado: string | null = null): HabitScheduleRow => ({
    id, nombre: `h${id}`, meta: 'm', frecuencia, activo: archivado === null, creado_dia: creado, archivado_dia: archivado,
  });

  test('total según frecuencia y vigencia; completados y parciales sin duplicar', () => {
    const out = buildDailySummary({
      desde: '2026-10-19',
      hasta: '2026-10-21',
      habitos: [h(1, 'Diaria', '2026-10-01'), h(2, 'L,X,V', '2026-10-01'), h(3, 'Diaria', '2026-10-20'), h(4, 'Diaria', '2026-10-01', '2026-10-20')],
      registros: [
        { habito_id: 1, dia: '2026-10-19', cumplido: true, valor: null },
        { habito_id: 2, dia: '2026-10-19', cumplido: false, valor: 10 },
        { habito_id: 4, dia: '2026-10-19', cumplido: true, valor: null },
        { habito_id: 1, dia: '2026-10-21', cumplido: false, valor: 0 },
      ],
    });
    assert.deepEqual(out, [
      { fecha: '2026-10-19', total: 3, completados: 2, parciales: 1 },
      { fecha: '2026-10-20', total: 2, completados: 0, parciales: 0 },
      { fecha: '2026-10-21', total: 3, completados: 0, parciales: 0 },
    ]);
  });

  test('valida el rango antes de consultar', async () => {
    const deps = { findHabits: async () => [], findRecordDays: async () => [], now: () => new Date('2026-10-26T15:00:00Z') };
    await assert.rejects(getProgressRange(1, { desde: '2026-10-20', hasta: '2026-10-10' }, 'America/Bogota', deps), /posterior/);
    await assert.rejects(getProgressRange(1, { desde: '2024-01-01', hasta: '2026-10-10' }, 'America/Bogota', deps), /máximo/);
    await assert.rejects(getProgressRange(1, { desde: '20-10-2026' }, 'America/Bogota', deps), /desde inválida/);
    const def = await getProgressRange(1, {}, 'America/Bogota', deps);
    assert.equal(def.length, 7);
    assert.equal(def.at(-1)!.fecha, '2026-10-26');
  });
});

describe('validaciones de entrada', () => {
  test('correo normalizado, contraseña 8..72 bytes, hora HH:MM', () => {
    assert.equal(validateCorreo('  Ana@Example.COM '), 'ana@example.com');
    assert.throws(() => validateCorreo('no-es-correo'), HttpError);
    assert.throws(() => validatePassword('corta'), HttpError);
    assert.throws(() => validatePassword('ñ'.repeat(40)), /72 bytes/);
    assert.equal(validateHora('07:30'), '07:30');
    assert.equal(validateHora('07:30:00'), '07:30');
    for (const bad of ['7:30', '24:00', '12:60', '12:30 PM', 1230]) {
      assert.throws(() => validateHora(bad), HttpError, String(bad));
    }
  });

  test('actualización parcial del hábito: solo los campos enviados; null borra', () => {
    assert.deepEqual(validateUpdateHabitInput({ icono: '💧' }), { icono: '💧' });
    assert.deepEqual(validateUpdateHabitInput({ categoria: null }), { categoria: null });
    assert.throws(() => validateUpdateHabitInput({}), /nada para actualizar/);
    assert.throws(() => validateUpdateHabitInput({ icono: 5 }), /icono/);
    assert.throws(() => validateUpdateHabitInput({ meta_valor: -1 }), /meta_valor/);
  });
});

describe('errorHandler', () => {
  function run(err: unknown): { status: number; body: unknown } {
    const out = { status: 0, body: undefined as unknown };
    const res = { status(s: number) { out.status = s; return this; }, json(b: unknown) { out.body = b; return this; } };
    const original = console.error;
    console.error = () => undefined;
    try {
      errorHandler(err, {} as never, res as never, () => undefined);
    } finally {
      console.error = original;
    }
    return out;
  }

  test('mapea errores de PostgreSQL sin filtrar detalles', () => {
    assert.deepEqual(run({ code: '23505', constraint: 'usuarios_correo_key' }), { status: 409, body: { error: 'correo ya registrado' } });
    assert.deepEqual(run({ code: '23505', constraint: 'otra' }), { status: 409, body: { error: 'conflicto: el recurso ya existe' } });
    assert.equal(run({ code: '23503' }).status, 409);
    assert.equal(run({ code: '22P02' }).status, 400);
    assert.equal(run({ type: 'entity.parse.failed' }).status, 400);
    const interno = run(Object.assign(new Error('SELECT * FROM usuarios password=secreta'), { stack: 'stack' }));
    assert.deepEqual(interno, { status: 500, body: { error: 'error interno' } });
  });
});
