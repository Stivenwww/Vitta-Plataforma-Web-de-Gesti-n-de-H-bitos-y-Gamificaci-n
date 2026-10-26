/**
 * Pruebas de integración contra PostgreSQL real.
 * Crea (y recrea en cada corrida) bases SOLO de prueba cuyo nombre termina en
 * `_test`, en el mismo servidor de DATABASE_URL (o TEST_DATABASE_URL). Nunca
 * toca la base de desarrollo. Si no hay servidor disponible, se omiten.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { join } from 'node:path';
import { Client } from 'pg';
import dotenv from 'dotenv';
// Sin E/S de BD: se puede importar antes de fijar DATABASE_URL.
import { todayIn } from '../../src/utils/timezone';

dotenv.config({ path: join(__dirname, '..', '..', '.env') });

const ROOT = join(__dirname, '..', '..');
const baseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? '';
const withDb = (url: string, db: string) => {
  const u = new URL(url);
  u.pathname = `/${db}`;
  return u.toString();
};
const TEST_DB = 'vitta_test';
const TEST_DB_TS = 'vitta_ts_test';
const testUrl = baseUrl ? withDb(baseUrl, TEST_DB) : '';

// Esquema de la primera versión (registros con fecha DATE), tal como está la
// BD local de desarrollo antes de esta migración.
const LEGACY_DATE_SCHEMA = `
CREATE TABLE usuarios (id SERIAL PRIMARY KEY, nombre TEXT NOT NULL CHECK (char_length(btrim(nombre)) > 0),
  correo TEXT NOT NULL UNIQUE CHECK (correo LIKE '%@%.%'), password_hash TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE habitos (id SERIAL PRIMARY KEY, usuario_id INTEGER NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  nombre TEXT NOT NULL, meta TEXT NOT NULL, frecuencia TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'personalizado' CHECK (tipo IN ('predefinido', 'personalizado')),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE registros_diarios (id SERIAL PRIMARY KEY, habito_id INTEGER NOT NULL REFERENCES habitos (id) ON DELETE RESTRICT,
  fecha DATE NOT NULL, cumplido BOOLEAN NOT NULL, valor NUMERIC NULL, UNIQUE (habito_id, fecha));
CREATE INDEX idx_registros_habito_fecha ON registros_diarios (habito_id, fecha);
CREATE TABLE rachas (habito_id INTEGER PRIMARY KEY REFERENCES habitos (id) ON DELETE CASCADE,
  racha_actual INTEGER NOT NULL DEFAULT 0, racha_maxima INTEGER NOT NULL DEFAULT 0,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now());
INSERT INTO usuarios (nombre, correo, password_hash) VALUES ('Legado', 'legado@vitta.test', 'x');
INSERT INTO habitos (usuario_id, nombre, meta, frecuencia) VALUES (1, 'Leer', '20 min', 'Diaria');
INSERT INTO registros_diarios (habito_id, fecha, cumplido, valor) VALUES
  (1, '2026-09-07', true, 30), (1, '2026-09-08', true, 30), (1, '2026-09-09', false, 0);
`;

// Versión D-07: fecha TIMESTAMPTZ con unicidad por día UTC.
const LEGACY_TS_SCHEMA = LEGACY_DATE_SCHEMA
  .replace('fecha DATE NOT NULL, cumplido BOOLEAN NOT NULL, valor NUMERIC NULL, UNIQUE (habito_id, fecha))',
    'fecha TIMESTAMPTZ NOT NULL, cumplido BOOLEAN NOT NULL, valor NUMERIC NULL)')
  .replace(`(1, '2026-09-07', true, 30), (1, '2026-09-08', true, 30), (1, '2026-09-09', false, 0);`,
    `(1, '2026-09-07T00:00:00Z', true, 30), (1, '2026-09-09T01:30:00Z', true, 30);
     CREATE UNIQUE INDEX uq_registros_habito_dia_utc ON registros_diarios (habito_id, ((fecha AT TIME ZONE 'UTC')::date));`);

// Síncrono para poder decidir el `skip` al declarar la suite.
function serverAvailable(): boolean {
  if (!baseUrl) return false;
  try {
    execFileSync(process.execPath, ['-e', `
      const { Client } = require('pg');
      const c = new Client({ connectionString: process.argv[1], connectionTimeoutMillis: 3000 });
      c.connect().then(() => c.end()).catch(() => process.exit(1));`, withDb(baseUrl, 'postgres')], { cwd: ROOT, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function recreate(db: string, ddl: string): Promise<void> {
  assert.ok(db.endsWith('_test'), 'solo se recrean bases de prueba');
  const admin = new Client({ connectionString: withDb(baseUrl, 'postgres') });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${db}`);
  await admin.end();
  const c = new Client({ connectionString: withDb(baseUrl, db) });
  await c.connect();
  await c.query(ddl);
  await c.end();
}

function runScript(script: string, dbUrl: string): string {
  return execFileSync(process.execPath, ['--import', 'tsx', script], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: dbUrl },
    encoding: 'utf8',
  });
}

const available = serverAvailable();
// Antes de cualquier import de src/db/pool: el pool se crea con esta URL.
if (available) process.env.DATABASE_URL = testUrl;
const opts = { skip: available ? false : 'PostgreSQL no disponible (DATABASE_URL/TEST_DATABASE_URL)' };

describe('integración (PostgreSQL)', opts, () => {
  let server: Server;
  let api: string;
  let db: Client;

  before(async () => {
    await recreate(TEST_DB, LEGACY_DATE_SCHEMA);
    const { migrate } = await import('../../src/db/migrate');
    await migrate();
    await migrate(); // repetible
    const { app } = await import('../../src/app');
    server = app.listen(0);
    api = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
    db = new Client({ connectionString: testUrl });
    await db.connect();
  });

  after(async () => {
    await db?.end();
    server?.close();
    const { pool } = await import('../../src/db/pool');
    await pool.end();
  });

  async function call(
    method: string,
    path: string,
    opts2: { token?: string; body?: unknown; tz?: string; raw?: string } = {},
  ): Promise<{ status: number; body: any }> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (opts2.token) headers.Authorization = `Bearer ${opts2.token}`;
    if (opts2.tz) headers['X-Timezone'] = opts2.tz;
    const res = await fetch(`${api}${path}`, {
      method,
      headers,
      body: opts2.raw ?? (opts2.body === undefined ? undefined : JSON.stringify(opts2.body)),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  }

  const addDays = (day: string, n: number) =>
    new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
  const hoy = todayIn('America/Bogota');
  const hace = (n: number) => addDays(hoy, -n);

  let tokenA = '';
  let tokenB = '';
  let userA = 0;

  describe('base de datos y migraciones', () => {
    test('las 8 tablas del modelo + recordatorios existen tras migrar un esquema antiguo', async () => {
      const r = await db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1`);
      assert.deepEqual(r.rows.map((x) => x.table_name), [
        'habitos', 'logros', 'movimientos_puntos', 'plantillas_habitos', 'rachas', 'recordatorios',
        'registros_diarios', 'usuario_logros', 'usuarios',
      ]);
    });

    test('los registros DATE conservan su día y los datos no se pierden', async () => {
      const r = await db.query(`SELECT to_char(dia, 'YYYY-MM-DD') AS dia, cumplido FROM registros_diarios ORDER BY dia`);
      assert.deepEqual(r.rows, [
        { dia: '2026-09-07', cumplido: true }, { dia: '2026-09-08', cumplido: true }, { dia: '2026-09-09', cumplido: false },
      ]);
    });

    test('esquema D-07 (TIMESTAMPTZ): medianoche UTC conserva el día; otros instantes van al día de Bogotá', async () => {
      await recreate(TEST_DB_TS, LEGACY_TS_SCHEMA);
      const url = withDb(baseUrl, TEST_DB_TS);
      runScript('src/db/migrate.ts', url);
      runScript('src/db/migrate.ts', url);
      const c = new Client({ connectionString: url });
      await c.connect();
      const r = await c.query(`SELECT to_char(dia, 'YYYY-MM-DD') AS dia FROM registros_diarios ORDER BY id`);
      const idx = await c.query(`SELECT indexname FROM pg_indexes WHERE tablename = 'registros_diarios' ORDER BY 1`);
      await c.end();
      assert.deepEqual(r.rows.map((x) => x.dia), ['2026-09-07', '2026-09-08']);
      assert.ok(idx.rows.some((x) => x.indexname === 'uq_registros_habito_dia'));
      assert.ok(!idx.rows.some((x) => x.indexname === 'uq_registros_habito_dia_utc'));
    });

    test('catálogo idempotente: 14 logros y 10 plantillas tras migrar dos veces', async () => {
      const r = await db.query('SELECT (SELECT count(*) FROM logros)::int AS l, (SELECT count(*) FROM plantillas_habitos)::int AS p');
      assert.deepEqual(r.rows[0], { l: 14, p: 10 });
    });

    test('integridad: no se puede borrar un hábito con registros ni duplicar día', async () => {
      // RESTRICT: 23001 en PostgreSQL ≥ 18, 23503 en versiones anteriores.
      await assert.rejects(db.query('DELETE FROM habitos WHERE id = 1'), (e: any) => ['23001', '23503'].includes(e.code));
      await assert.rejects(
        db.query(`INSERT INTO registros_diarios (habito_id, fecha, dia, cumplido) VALUES (1, now(), '2026-09-07', true)`),
        { code: '23505' },
      );
    });
  });

  describe('auth y perfil', () => {
    test('registro normaliza el correo; duplicado sin distinguir mayúsculas → 409', async () => {
      const a = await call('POST', '/auth/register', { body: { nombre: 'Ana', correo: 'Ana@Vitta.TEST', password: 'clave-segura-1' } });
      assert.equal(a.status, 201);
      assert.equal(a.body.usuario.correo, 'ana@vitta.test');
      assert.equal(a.body.usuario.password_hash, undefined);
      userA = a.body.usuario.id;
      tokenA = a.body.token;
      const dup = await call('POST', '/auth/register', { body: { nombre: 'Otra', correo: 'ANA@vitta.test', password: 'clave-segura-1' } });
      assert.equal(dup.status, 409);
      const b = await call('POST', '/auth/register', { body: { nombre: 'Beto', correo: 'beto@vitta.test', password: 'clave-segura-2' } });
      tokenB = b.body.token;
    });

    test('login devuelve creado_en real de la BD y nada sensible', async () => {
      const r = await call('POST', '/auth/login', { body: { correo: 'ANA@vitta.test', password: 'clave-segura-1' } });
      assert.equal(r.status, 200);
      const row = await db.query('SELECT creado_en FROM usuarios WHERE id = $1', [userA]);
      assert.equal(r.body.usuario.creado_en, row.rows[0].creado_en.toISOString());
      assert.deepEqual(Object.keys(r.body.usuario).sort(), ['correo', 'creado_en', 'id', 'nombre']);
      const me = await call('GET', '/users/me', { token: tokenA });
      assert.equal(me.body.creado_en, r.body.usuario.creado_en);
    });

    test('credenciales inválidas, sin token, token falso y JSON roto', async () => {
      assert.equal((await call('POST', '/auth/login', { body: { correo: 'ana@vitta.test', password: 'mala-clave' } })).status, 401);
      assert.equal((await call('GET', '/habits')).status, 401);
      assert.equal((await call('GET', '/habits', { token: 'abc.def.ghi' })).status, 401);
      assert.equal((await call('POST', '/auth/login', { raw: '{"correo":' })).status, 400);
    });

    test('PATCH /users/me: parcial, valida, 409 si el correo es de otro', async () => {
      const r = await call('PATCH', '/users/me', { token: tokenA, body: { nombre: 'Ana María' } });
      assert.equal(r.status, 200);
      assert.equal(r.body.usuario.nombre, 'Ana María');
      assert.equal(r.body.usuario.correo, 'ana@vitta.test');
      tokenA = r.body.token;
      assert.equal((await call('PATCH', '/users/me', { token: tokenA, body: { correo: 'BETO@vitta.test' } })).status, 409);
      assert.equal((await call('PATCH', '/users/me', { token: tokenA, body: { correo: 'no-es-correo' } })).status, 400);
      assert.equal((await call('PATCH', '/users/me', { token: tokenA, body: {} })).status, 400);
      // El id del cuerpo se ignora: solo cambia el usuario del token.
      await call('PATCH', '/users/me', { token: tokenA, body: { id: 999, nombre: 'Ana' } });
      const beto = await db.query(`SELECT nombre FROM usuarios WHERE correo = 'beto@vitta.test'`);
      assert.equal(beto.rows[0].nombre, 'Beto');
    });

    test('cambio de contraseña: rechaza la actual incorrecta, invalida tokens viejos', async () => {
      const mala = await call('PATCH', '/users/me/password', { token: tokenA, body: { contrasena_actual: 'otra-cosa', contrasena_nueva: 'nueva-clave-9' } });
      assert.equal(mala.status, 403);
      const corta = await call('PATCH', '/users/me/password', { token: tokenA, body: { contrasena_actual: 'clave-segura-1', contrasena_nueva: 'corta' } });
      assert.equal(corta.status, 400);
      const ok = await call('PATCH', '/users/me/password', { token: tokenA, body: { contrasena_actual: 'clave-segura-1', contrasena_nueva: 'nueva-clave-9' } });
      assert.equal(ok.status, 200);
      assert.equal(JSON.stringify(ok.body).includes('$2'), false); // nunca el hash
      assert.equal((await call('GET', '/habits', { token: tokenA })).status, 401);
      tokenA = ok.body.token;
      assert.equal((await call('GET', '/habits', { token: tokenA })).status, 200);
      assert.equal((await call('POST', '/auth/login', { body: { correo: 'ana@vitta.test', password: 'nueva-clave-9' } })).status, 200);
      const hash = await db.query('SELECT password_hash FROM usuarios WHERE id = $1', [userA]);
      assert.match(hash.rows[0].password_hash, /^\$2[aby]\$10\$/);
    });
  });

  let agua = 0;
  let leer = 0;

  describe('hábitos: icono, categoría, edición parcial y aislamiento', () => {
    test('crear con icono/categoría/meta_valor y recuperarlos', async () => {
      const r = await call('POST', '/habits', { token: tokenA, body: {
        nombre: 'Tomar agua', meta: '8 vasos', frecuencia: 'Diaria', tipo: 'predefinido',
        icono: 'water', categoria: 'Hidratación', meta_valor: 8, unidad: 'vasos',
      } });
      assert.equal(r.status, 201);
      assert.equal(r.body.icono, 'water');
      assert.equal(r.body.categoria, 'Hidratación');
      assert.equal(r.body.meta_valor, 8);
      assert.equal(r.body.activo, true);
      agua = r.body.id;
      const l = await call('POST', '/habits', { token: tokenA, body: { nombre: 'Leer', meta: '20 minutos', frecuencia: 'Diaria', icono: '📚', categoria: 'Lectura' } });
      leer = l.body.id;
      const list = await call('GET', '/habits', { token: tokenA });
      assert.deepEqual(list.body.map((h: any) => [h.id, h.icono, h.categoria]), [[agua, 'water', 'Hidratación'], [leer, '📚', 'Lectura']]);
    });

    test('editar un campo no borra icono ni categoría; null los limpia', async () => {
      const r = await call('PUT', `/habits/${agua}`, { token: tokenA, body: { nombre: 'Beber agua' } });
      assert.equal(r.status, 200);
      assert.deepEqual([r.body.nombre, r.body.icono, r.body.categoria, r.body.meta_valor], ['Beber agua', 'water', 'Hidratación', 8]);
      const c = await call('PUT', `/habits/${leer}`, { token: tokenA, body: { categoria: null } });
      assert.equal(c.body.categoria, null);
      await call('PUT', `/habits/${leer}`, { token: tokenA, body: { categoria: 'Lectura' } });
      assert.equal((await call('PUT', `/habits/${agua}`, { token: tokenA, body: { icono: 7 } })).status, 400);
    });

    test('otro usuario no puede ver, editar ni borrar', async () => {
      assert.equal((await call('GET', `/habits/${agua}`, { token: tokenB })).status, 404);
      assert.equal((await call('PUT', `/habits/${agua}`, { token: tokenB, body: { nombre: 'x' } })).status, 404);
      assert.equal((await call('DELETE', `/habits/${agua}`, { token: tokenB })).status, 404);
      assert.equal((await call('GET', `/habits/${agua}/records`, { token: tokenB })).status, 404);
      assert.equal((await call('GET', '/habits', { token: tokenB })).body.length, 0);
      assert.equal((await call('GET', '/habits/abc', { token: tokenA })).status, 400);
      assert.equal((await call('GET', '/habits/999999', { token: tokenA })).status, 404);
    });
  });

  describe('registros diarios, notas y zona horaria', () => {
    test('crear con notas; las notas se devuelven en GET records', async () => {
      const r = await call('POST', `/habits/${leer}/records`, { token: tokenA, body: { fecha: hace(3), cumplido: true, notas: 'Capítulo 3' } });
      assert.equal(r.status, 201);
      assert.equal(r.body.dia, hace(3));
      assert.equal(r.body.notas, 'Capítulo 3');
      const list = await call('GET', `/habits/${leer}/records`, { token: tokenA });
      assert.equal(list.body[0].notas, 'Capítulo 3');
      assert.equal(list.body[0].dia, hace(3));
    });

    test('mismo hábito y día → 409; fecha futura o inválida → 400; notas muy largas → 400', async () => {
      assert.equal((await call('POST', `/habits/${leer}/records`, { token: tokenA, body: { fecha: hace(3), cumplido: false } })).status, 409);
      assert.equal((await call('POST', `/habits/${leer}/records`, { token: tokenA, body: { fecha: addDays(hoy, 2), cumplido: true } })).status, 400);
      assert.equal((await call('POST', `/habits/${leer}/records`, { token: tokenA, body: { fecha: '26/10/2026', cumplido: true } })).status, 400);
      assert.equal((await call('POST', `/habits/${leer}/records`, { token: tokenA, body: { fecha: hace(9), cumplido: true, notas: 'x'.repeat(1001) } })).status, 400);
    });

    test('20:30 en Bogotá queda en ese día aunque en UTC ya sea el siguiente', async () => {
      const r = await call('POST', `/habits/${leer}/records`, { token: tokenA, body: { fecha: `${hace(2)}T20:30:00-05:00`, cumplido: true } });
      assert.equal(r.status, 201);
      assert.equal(r.body.dia, hace(2));
      assert.equal(r.body.fecha, new Date(`${hace(2)}T20:30:00-05:00`).toISOString());
      // A esa misma hora UTC (01:30 del día siguiente) no se puede duplicar el día local.
      const dup = await call('POST', `/habits/${leer}/records`, { token: tokenA, body: { fecha: `${hace(1)}T01:30:00Z`, cumplido: true } });
      assert.equal(dup.status, 409);
    });

    test('X-Timezone: otra zona válida se respeta; una inválida → 400', async () => {
      const tokyo = await call('POST', `/habits/${leer}/records`, { token: tokenA, tz: 'Asia/Tokyo', body: { fecha: `${hace(5)}T23:30:00Z`, cumplido: false } });
      assert.equal(tokyo.status, 201);
      assert.equal(tokyo.body.dia, hace(4));
      await call('DELETE', `/habits/${leer}/records/${tokyo.body.id}`, { token: tokenA });
      assert.equal((await call('GET', '/habits', { token: tokenA, tz: 'Mars/Olympus' })).status, 400);
    });
  });

  describe('progreso parcial (PATCH /habits/:id/progreso)', () => {
    const puntos = async () => (await call('GET', '/points/me', { token: tokenA })).body.puntos_totales as number;

    test('guarda avance parcial sin completar ni sumar puntos, y se recupera', async () => {
      const antes = await puntos();
      const r = await call('PATCH', `/habits/${agua}/progreso`, { token: tokenA, body: { valor: 3, fecha: hoy, notas: 'mañana' } });
      assert.equal(r.status, 200);
      assert.deepEqual([r.body.valor, r.body.cumplido, r.body.dia], [3, false, hoy]);
      const list = await call('GET', `/habits/${agua}/records`, { token: tokenA });
      assert.deepEqual(list.body.map((x: any) => [x.dia, x.valor, x.cumplido, x.notas]), [[hoy, 3, false, 'mañana']]);
      assert.equal(await puntos(), antes);
    });

    test('al llegar a la meta se completa una sola vez; bajar retira los puntos; notas se conservan', async () => {
      const antes = await puntos();
      const r = await call('PATCH', `/habits/${agua}/progreso`, { token: tokenA, body: { valor: 8 } });
      assert.equal(r.body.cumplido, true);
      assert.equal(r.body.notas, 'mañana');
      const tras = await puntos();
      assert.ok(tras >= antes + 10);
      await call('PATCH', `/habits/${agua}/progreso`, { token: tokenA, body: { valor: 9 } });
      assert.equal(await puntos(), tras); // reintento: sin puntos dobles
      const baja = await call('PATCH', `/habits/${agua}/progreso`, { token: tokenA, body: { valor: 5 } });
      assert.equal(baja.body.cumplido, false);
      assert.equal(await puntos(), tras - 10);
      const n = await db.query('SELECT count(*)::int AS n FROM registros_diarios WHERE habito_id = $1', [agua]);
      assert.equal(n.rows[0].n, 1);
      await call('PATCH', `/habits/${agua}/progreso`, { token: tokenA, body: { valor: 8 } });
      assert.equal(await puntos(), tras);
    });

    test('validaciones: sin meta numérica, valor inválido, hábito ajeno', async () => {
      assert.equal((await call('PATCH', `/habits/${leer}/progreso`, { token: tokenA, body: { valor: 3 } })).status, 400);
      assert.equal((await call('PATCH', `/habits/${agua}/progreso`, { token: tokenA, body: { valor: -1 } })).status, 400);
      assert.equal((await call('PATCH', `/habits/${agua}/progreso`, { token: tokenA, body: { valor: 'tres' } })).status, 400);
      assert.equal((await call('PATCH', `/habits/${agua}/progreso`, { token: tokenB, body: { valor: 3 } })).status, 404);
    });
  });

  describe('rachas', () => {
    test('consecutivos, día perdido y máxima conservada', async () => {
      const h = (await call('POST', '/habits', { token: tokenA, body: { nombre: 'Correr', meta: '1', frecuencia: 'Diaria' } })).body.id;
      for (const d of [6, 5, 4, 2, 1]) {
        await call('POST', `/habits/${h}/records`, { token: tokenA, body: { fecha: hace(d), cumplido: true } });
      }
      let s = await call('GET', `/habits/${h}/streak`, { token: tokenA });
      assert.deepEqual([s.body.racha_actual, s.body.racha_maxima], [2, 3]);
      const marca = await call('POST', `/habits/${h}/records`, { token: tokenA, body: { cumplido: false } });
      assert.equal(marca.body.racha.racha_actual, 0);
      s = await call('GET', `/habits/${h}/streak`, { token: tokenA });
      assert.deepEqual([s.body.racha_actual, s.body.racha_maxima], [0, 3]);
    });

    test('día perdido sin registrar nada: la racha consultada ya es 0 (CA-02)', async () => {
      const h = (await call('POST', '/habits', { token: tokenA, body: { nombre: 'Estirar', meta: '1', frecuencia: 'Diaria' } })).body.id;
      await call('POST', `/habits/${h}/records`, { token: tokenA, body: { fecha: hace(4), cumplido: true } });
      await call('POST', `/habits/${h}/records`, { token: tokenA, body: { fecha: hace(3), cumplido: true } });
      const s = await call('GET', `/habits/${h}/streak`, { token: tokenA });
      assert.deepEqual([s.body.racha_actual, s.body.racha_maxima], [0, 2]);
    });
  });

  describe('logros y puntos', () => {
    test('GET /logros: 14 logros con progreso; Primer Brote ya desbloqueado con fecha', async () => {
      const r = await call('GET', '/logros', { token: tokenA });
      assert.equal(r.status, 200);
      assert.equal(r.body.length, 14);
      for (const l of r.body) {
        assert.deepEqual(Object.keys(l).sort(), ['condicion', 'descripcion', 'icono', 'id', 'nombre', 'obtenido', 'obtenido_en', 'progreso_actual', 'progreso_meta', 'puntos_bonus']);
        assert.ok(l.progreso_actual <= l.progreso_meta);
      }
      const brote = r.body.find((l: any) => l.nombre === 'Primer Brote');
      assert.equal(brote.obtenido, true);
      assert.ok(!Number.isNaN(Date.parse(brote.obtenido_en)));
      const lector = r.body.find((l: any) => l.nombre === 'Lector Constante');
      assert.deepEqual([lector.obtenido, lector.progreso_actual, lector.progreso_meta], [false, 2, 30]);
      const b = await call('GET', '/logros', { token: tokenB });
      assert.ok(b.body.every((l: any) => l.obtenido === false && l.progreso_actual === 0));
    });

    test('el bono se acredita una sola vez aunque se consulte o registre varias veces', async () => {
      await Promise.all([1, 2, 3, 4].map(() => call('GET', '/logros', { token: tokenA })));
      const r = await db.query(
        `SELECT (SELECT count(*) FROM usuario_logros ul JOIN logros l ON l.id = ul.logro_id WHERE ul.usuario_id = $1 AND l.nombre = 'Primer Brote')::int AS ul,
                (SELECT count(*) FROM movimientos_puntos m JOIN logros l ON l.id = m.logro_id WHERE m.usuario_id = $1 AND l.nombre = 'Primer Brote')::int AS bono`,
        [userA],
      );
      assert.deepEqual(r.rows[0], { ul: 1, bono: 1 });
    });

    test('7 lecturas desbloquean Mente Curiosa; racha de 7, Primer Impulso; la respuesta lo informa', async () => {
      const desbloqueos: Record<string, string> = {};
      for (const d of [10, 9, 8, 7, 6, 5, 4]) {
        const r = await call('POST', `/habits/${leer}/records`, { token: tokenA, body: { fecha: hace(d), cumplido: true } });
        assert.equal(r.status, 201);
        for (const l of r.body.logros_desbloqueados) desbloqueos[l.nombre] = hace(d);
      }
      // Ya había 2 lecturas (hace 3 y 2 días): la 7.ª es la de hace 6 días. La
      // racha llega a 9 (de hace 10 a hace 2) con la última, la de hace 4.
      assert.deepEqual(desbloqueos, { 'Mente Curiosa': hace(6), 'Primer Impulso': hace(4) });
      const logros = await call('GET', '/logros', { token: tokenA });
      assert.equal(logros.body.find((l: any) => l.nombre === 'Mente Curiosa').obtenido, true);
      const impulso = logros.body.find((l: any) => l.nombre === 'Primer Impulso');
      assert.deepEqual([impulso.obtenido, impulso.progreso_actual, impulso.progreso_meta], [true, 7, 7]);
    });

    test('En Equilibrio: 3 categorías cumplidas en una misma semana', async () => {
      const lunes = addDays(hoy, -(((new Date(`${hoy}T00:00:00Z`).getUTCDay() + 6) % 7)) - 7);
      const mk = async (nombre: string, categoria: string) =>
        (await call('POST', '/habits', { token: tokenB, body: { nombre, meta: '1', frecuencia: 'Diaria', categoria } })).body.id;
      const ids = [await mk('Yoga', 'Bienestar'), await mk('Fruta', 'Alimentación'), await mk('Dormir', 'Descanso')];
      const r1 = await call('POST', `/habits/${ids[0]}/records`, { token: tokenB, body: { fecha: lunes, cumplido: true } });
      await call('POST', `/habits/${ids[1]}/records`, { token: tokenB, body: { fecha: addDays(lunes, 2), cumplido: true } });
      assert.ok(!r1.body.logros_desbloqueados.some((l: any) => l.nombre === 'En Equilibrio'));
      const r3 = await call('POST', `/habits/${ids[2]}/records`, { token: tokenB, body: { fecha: addDays(lunes, 6), cumplido: true } });
      assert.ok(r3.body.logros_desbloqueados.some((l: any) => l.nombre === 'En Equilibrio'));
    });

    test('peticiones concurrentes del mismo día: un solo registro y un solo cobro de puntos', async () => {
      const h = (await call('POST', '/habits', { token: tokenB, body: { nombre: 'Concurrencia', meta: '1', frecuencia: 'Diaria' } })).body.id;
      const antes = (await call('GET', '/points/me', { token: tokenB })).body.puntos_totales;
      const res = await Promise.all([1, 2, 3, 4, 5].map(() => call('POST', `/habits/${h}/records`, { token: tokenB, body: { cumplido: true } })));
      assert.deepEqual(res.map((r) => r.status).sort(), [201, 409, 409, 409, 409]);
      const despues = (await call('GET', '/points/me', { token: tokenB })).body.puntos_totales;
      const bonos = res.find((r) => r.status === 201)!.body.logros_desbloqueados.reduce((a: number, l: any) => a + l.puntos_bonus, 0);
      assert.equal(despues, antes + 10 + bonos);
    });

    test('desmarcar retira los puntos del registro y recalcula la racha', async () => {
      const list = await call('GET', `/habits/${leer}/records`, { token: tokenA });
      const ultimo = list.body.at(-1);
      const antes = (await call('GET', '/points/me', { token: tokenA })).body.puntos_totales;
      const del = await call('DELETE', `/habits/${leer}/records/${ultimo.id}`, { token: tokenA });
      assert.equal(del.status, 200);
      assert.equal((await call('GET', '/points/me', { token: tokenA })).body.puntos_totales, antes - 10);
      assert.equal((await call('DELETE', `/habits/${leer}/records/${ultimo.id}`, { token: tokenA })).status, 404);
      assert.equal((await call('DELETE', `/habits/${leer}/records/${ultimo.id}`, { token: tokenB })).status, 404);
    });
  });

  describe('archivado y eliminación', () => {
    test('DELETE con historial archiva: sale del listado, conserva registros, no admite nuevos', async () => {
      const r = await call('DELETE', `/habits/${leer}`, { token: tokenA });
      assert.equal(r.status, 200);
      assert.equal(r.body.archivado, true);
      assert.ok(!(await call('GET', '/habits', { token: tokenA })).body.some((h: any) => h.id === leer));
      const todos = await call('GET', '/habits?incluir_archivados=true', { token: tokenA });
      assert.equal(todos.body.find((h: any) => h.id === leer).activo, false);
      assert.ok((await call('GET', `/habits/${leer}/records`, { token: tokenA })).body.length > 0);
      assert.equal((await call('POST', `/habits/${leer}/records`, { token: tokenA, body: { cumplido: true } })).status, 409);
      const rest = await call('POST', `/habits/${leer}/restore`, { token: tokenA });
      assert.deepEqual([rest.status, rest.body.activo, rest.body.archivado_en], [200, true, null]);
    });

    test('DELETE sin historial elimina de verdad', async () => {
      const h = (await call('POST', '/habits', { token: tokenA, body: { nombre: 'Temporal', meta: '1', frecuencia: 'Diaria' } })).body.id;
      const r = await call('DELETE', `/habits/${h}`, { token: tokenA });
      assert.deepEqual(r.body, { mensaje: 'hábito eliminado', archivado: false });
      assert.equal((await call('GET', `/habits/${h}`, { token: tokenA })).status, 404);
    });

    test('archivar explícitamente y ajeno → 404', async () => {
      const a = await call('POST', `/habits/${agua}/archive`, { token: tokenA });
      assert.equal(a.body.activo, false);
      await call('POST', `/habits/${agua}/restore`, { token: tokenA });
      assert.equal((await call('POST', `/habits/${agua}/archive`, { token: tokenB })).status, 404);
    });
  });

  describe('recordatorios', () => {
    let id = 0;
    test('CRUD completo', async () => {
      const c = await call('POST', '/recordatorios', { token: tokenA, body: { habito_id: agua, hora: '07:30' } });
      assert.equal(c.status, 201);
      assert.deepEqual([c.body.habito_id, c.body.hora, c.body.activo], [agua, '07:30', true]);
      id = c.body.id;
      const l = await call('GET', '/recordatorios', { token: tokenA });
      assert.deepEqual(l.body.map((x: any) => x.id), [id]);
      const p = await call('PATCH', `/recordatorios/${id}`, { token: tokenA, body: { hora: '21:15', activo: false } });
      assert.deepEqual([p.status, p.body.hora, p.body.activo], [200, '21:15', false]);
      const p2 = await call('PATCH', `/recordatorios/${id}`, { token: tokenA, body: { activo: true } });
      assert.deepEqual([p2.body.hora, p2.body.activo], ['21:15', true]);
    });

    test('validaciones, duplicado y aislamiento por usuario', async () => {
      assert.equal((await call('POST', '/recordatorios', { token: tokenA, body: { habito_id: agua, hora: '25:00' } })).status, 400);
      assert.equal((await call('POST', '/recordatorios', { token: tokenA, body: { habito_id: agua, hora: '21:15' } })).status, 409);
      assert.equal((await call('POST', '/recordatorios', { token: tokenB, body: { habito_id: agua, hora: '08:00' } })).status, 404);
      assert.equal((await call('GET', '/recordatorios', { token: tokenB })).body.length, 0);
      assert.equal((await call('PATCH', `/recordatorios/${id}`, { token: tokenB, body: { activo: false } })).status, 404);
      assert.equal((await call('DELETE', `/recordatorios/${id}`, { token: tokenB })).status, 404);
      assert.equal((await call('GET', '/recordatorios')).status, 401);
    });

    test('eliminar', async () => {
      assert.equal((await call('DELETE', `/recordatorios/${id}`, { token: tokenA })).status, 200);
      assert.equal((await call('DELETE', `/recordatorios/${id}`, { token: tokenA })).status, 404);
    });
  });

  describe('progreso agregado GET /progress', () => {
    test('serie diaria ordenada con total/completados/parciales del usuario', async () => {
      const r = await call('GET', `/progress?desde=${hace(3)}&hasta=${hoy}`, { token: tokenA });
      assert.equal(r.status, 200);
      assert.deepEqual(r.body.map((d: any) => d.fecha), [hace(3), hace(2), hace(1), hoy]);
      for (const d of r.body) {
        assert.ok(d.completados + d.parciales <= d.total);
      }
      const hoyRes = r.body.at(-1);
      // Hoy: agua (cumplido) + Correr ("no" explícito) + Estirar + Leer (restaurado) = 4 activos.
      assert.deepEqual([hoyRes.total, hoyRes.completados], [4, 1]);
    });

    test('rango inválido → 400; sin token → 401', async () => {
      assert.equal((await call('GET', `/progress?desde=${hoy}&hasta=${hace(3)}`, { token: tokenA })).status, 400);
      assert.equal((await call('GET', '/progress?desde=ayer', { token: tokenA })).status, 400);
      assert.equal((await call('GET', '/progress')).status, 401);
    });
  });

  describe('semilla', () => {
    test('npm run seed es repetible y no duplica logros', async () => {
      runScript('src/db/seed.ts', testUrl);
      const out = runScript('src/db/seed.ts', testUrl);
      assert.match(out, /Semilla lista/);
      const r = await db.query(
        `SELECT (SELECT count(*) FROM logros)::int AS logros,
                (SELECT count(*) FROM usuarios WHERE correo LIKE '%@demo.vitta')::int AS demo,
                (SELECT count(*) FROM usuario_logros ul JOIN usuarios u ON u.id = ul.usuario_id WHERE u.correo = 'demo@demo.vitta')::int AS obtenidos`,
      );
      assert.equal(r.rows[0].logros, 14);
      assert.equal(r.rows[0].demo, 2);
      assert.ok(r.rows[0].obtenidos >= 1);
    });
  });
});
