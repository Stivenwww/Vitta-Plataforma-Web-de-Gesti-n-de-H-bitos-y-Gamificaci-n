/**
 * Datos semilla para que el frontend pueda trabajar sin crear datos a mano.
 * Uso:  npm run seed
 * Es repetible: borra y vuelve a crear SOLO los usuarios demo (correo @demo.vitta).
 * Las fechas son relativas a hoy (últimos 28 días, terminando AYER para que
 * "hoy" quede libre y se pueda marcar desde la app).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import bcrypt from 'bcrypt';
import { pool } from './pool';
import { computeStreaksFromRecords } from '../services/streakRecalc';
import { PUNTOS_POR_CUMPLIMIENTO, MOTIVO_HABITO_CUMPLIDO } from '../services/pointService';

const PASSWORD = 'Demo1234!';
const DIAS = 28;

interface HabitSeed {
  nombre: string;
  meta: string;
  frecuencia: string;
  categoria: string;
  icono: string;
  meta_valor: number;
  unidad: string;
  dias_semana: number[] | null;
  /** índice 0 = hace 28 días ... 27 = ayer; true=cumplido, false=no cumplido, null=sin registro */
  patron: (i: number, isoDow: number) => boolean | null;
}

const HABITOS: HabitSeed[] = [
  {
    nombre: 'Tomar agua', meta: '8 vasos', frecuencia: 'Diaria', categoria: 'Salud',
    icono: 'water', meta_valor: 8, unidad: 'vasos', dias_semana: null,
    // racha larga reciente: últimos 12 días cumplidos
    patron: (i) => (i >= DIAS - 12 ? true : i % 3 === 0 ? false : true),
  },
  {
    nombre: 'Leer', meta: '20 minutos', frecuencia: 'Diaria', categoria: 'Estudio',
    icono: 'book', meta_valor: 20, unidad: 'minutos', dias_semana: null,
    // racha rota ayer (racha actual 0)
    patron: (i) => (i === DIAS - 1 ? false : i % 4 === 1 ? false : i % 5 === 0 ? null : true),
  },
  {
    nombre: 'Ejercicio', meta: '30 minutos', frecuencia: 'L,X,V', categoria: 'Salud',
    icono: 'fitness', meta_valor: 30, unidad: 'minutos', dias_semana: [1, 3, 5],
    // solo se registra en los días programados (lunes, miércoles, viernes)
    patron: (i, dow) => ([1, 3, 5].includes(dow) ? i % 6 !== 0 : null),
  },
  {
    nombre: 'Meditar', meta: '10 minutos', frecuencia: 'Diaria', categoria: 'Bienestar',
    icono: 'meditate', meta_valor: 10, unidad: 'minutos', dias_semana: null,
    // hábito nuevo: pocos registros
    patron: (i) => (i >= DIAS - 5 ? i % 2 === 0 : null),
  },
];

function diaUtc(offsetDesdeHoy: number): Date {
  const hoy = new Date();
  return new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate() + offsetDesdeHoy, 12, 0, 0));
}

async function main(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Limpieza de los usuarios demo (registros y puntos usan RESTRICT)
    const demo = `SELECT id FROM usuarios WHERE correo LIKE '%@demo.vitta'`;
    await client.query(`DELETE FROM movimientos_puntos WHERE usuario_id IN (${demo})`);
    await client.query(
      `DELETE FROM registros_diarios WHERE habito_id IN (SELECT id FROM habitos WHERE usuario_id IN (${demo}))`,
    );
    await client.query(`DELETE FROM usuarios WHERE correo LIKE '%@demo.vitta'`);

    const hash = await bcrypt.hash(PASSWORD, 10);
    const u1 = await client.query<{ id: number }>(
      `INSERT INTO usuarios (nombre, correo, password_hash) VALUES ('Usuario Demo', 'demo@demo.vitta', $1) RETURNING id`,
      [hash],
    );
    // Usuario vacío: para probar pantallas de "aún no tienes hábitos"
    await client.query(
      `INSERT INTO usuarios (nombre, correo, password_hash) VALUES ('Usuario Nuevo', 'nuevo@demo.vitta', $1)`,
      [hash],
    );
    const usuarioId = u1.rows[0]!.id;

    // Catálogos (logros y plantillas) desde el SQL versionado
    await client.query(readFileSync(join(__dirname, 'catalogos.sql'), 'utf8'));

    let totalPuntos = 0;
    for (const h of HABITOS) {
      const hab = await client.query<{ id: number }>(
        `INSERT INTO habitos (usuario_id, nombre, meta, frecuencia, tipo, categoria, icono, meta_valor, unidad, dias_semana, creado_en)
         VALUES ($1,$2,$3,$4,'predefinido',$5,$6,$7,$8,$9,$10) RETURNING id`,
        [usuarioId, h.nombre, h.meta, h.frecuencia, h.categoria, h.icono, h.meta_valor, h.unidad, h.dias_semana, diaUtc(-DIAS)],
      );
      const habitoId = hab.rows[0]!.id;
      const registros: { fecha: string; cumplido: boolean }[] = [];

      for (let i = 0; i < DIAS; i += 1) {
        const fecha = diaUtc(-(DIAS - i));
        const dow = fecha.getUTCDay() === 0 ? 7 : fecha.getUTCDay();
        const estado = h.patron(i, dow);
        if (estado === null) continue;
        const r = await client.query<{ id: number }>(
          `INSERT INTO registros_diarios (habito_id, fecha, cumplido, valor, reflexion)
           VALUES ($1,$2,$3,$4,$5) RETURNING id`,
          [habitoId, fecha, estado, estado ? h.meta_valor : 0, estado && i % 7 === 0 ? 'Buen día, lo logré.' : null],
        );
        registros.push({ fecha: fecha.toISOString(), cumplido: estado });
        if (estado) {
          await client.query(
            `INSERT INTO movimientos_puntos (usuario_id, registro_id, puntos, motivo, creado_en)
             VALUES ($1,$2,$3,$4,$5)`,
            [usuarioId, r.rows[0]!.id, PUNTOS_POR_CUMPLIMIENTO, MOTIVO_HABITO_CUMPLIDO, fecha],
          );
          totalPuntos += PUNTOS_POR_CUMPLIMIENTO;
        }
      }

      const { actual, maxima } = computeStreaksFromRecords(registros);
      await client.query(
        `INSERT INTO rachas (habito_id, racha_actual, racha_maxima) VALUES ($1,$2,$3)
         ON CONFLICT (habito_id) DO UPDATE SET racha_actual = $2, racha_maxima = $3, actualizado_en = now()`,
        [habitoId, actual, maxima],
      );
    }

    // Logros ya obtenidos por el usuario demo
    await client.query(
      `INSERT INTO usuario_logros (usuario_id, logro_id)
       SELECT $1, id FROM logros WHERE nombre IN ('Primer Brote','Primer Impulso','Mente Curiosa')
       ON CONFLICT DO NOTHING`,
      [usuarioId],
    );

    await client.query('COMMIT');
    console.log('Semilla lista.');
    console.log('  demo@demo.vitta  /  ' + PASSWORD + '   (4 hábitos, 28 días de historial, ' + totalPuntos + ' VitaPuntos)');
    console.log('  nuevo@demo.vitta /  ' + PASSWORD + '   (sin datos)');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Error en la semilla:', err);
  process.exit(1);
});
