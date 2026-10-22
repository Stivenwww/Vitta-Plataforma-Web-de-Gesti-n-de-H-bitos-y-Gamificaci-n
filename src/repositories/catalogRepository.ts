import { query } from '../db/pool';

export interface PlantillaRow {
  id: number;
  nombre: string;
  categoria: string | null;
  icono: string | null;
  meta_valor_sugerida: string | null;
  unidad: string | null;
}

export interface LogroRow {
  id: number;
  nombre: string;
  descripcion: string;
  icono: string | null;
  condicion: string;
  puntos_bonus: number;
  obtenido: boolean;
  obtenido_en: string | null;
}

export interface PerfilRow {
  id: number;
  nombre: string;
  correo: string;
  creado_en: string;
  habitos_activos: number;
  logros_obtenidos: number;
}

export async function listPlantillas(): Promise<PlantillaRow[]> {
  const r = await query<PlantillaRow>(
    `SELECT id, nombre, categoria, icono, meta_valor_sugerida::float8 AS meta_valor_sugerida, unidad
     FROM plantillas_habitos ORDER BY id`,
  );
  return r.rows;
}

/** Catálogo completo de logros, marcando los que ya obtuvo el usuario. */
export async function listLogrosForUser(usuarioId: number): Promise<LogroRow[]> {
  const r = await query<LogroRow>(
    `SELECT l.id, l.nombre, l.descripcion, l.icono, l.condicion, l.puntos_bonus,
            (ul.id IS NOT NULL) AS obtenido, ul.obtenido_en
     FROM logros l
     LEFT JOIN usuario_logros ul ON ul.logro_id = l.id AND ul.usuario_id = $1
     ORDER BY l.id`,
    [usuarioId],
  );
  return r.rows;
}

export async function findPerfil(usuarioId: number): Promise<PerfilRow | null> {
  const r = await query<PerfilRow>(
    `SELECT u.id, u.nombre, u.correo, u.creado_en,
            (SELECT COUNT(*)::int FROM habitos h WHERE h.usuario_id = u.id AND h.activo) AS habitos_activos,
            (SELECT COUNT(*)::int FROM usuario_logros ul WHERE ul.usuario_id = u.id) AS logros_obtenidos
     FROM usuarios u WHERE u.id = $1`,
    [usuarioId],
  );
  return r.rows[0] ?? null;
}
