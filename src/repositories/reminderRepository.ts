import { query } from '../db/pool';

export interface Reminder {
  id: number;
  habito_id: number;
  habito_nombre: string;
  /** Hora local `HH:MM` (24 h). */
  hora: string;
  activo: boolean;
  creado_en: string;
}

// Siempre filtrado por usuario_id: un recordatorio ajeno se comporta como inexistente.
const SELECT_FROM = `
  SELECT r.id, r.habito_id, h.nombre AS habito_nombre, to_char(r.hora, 'HH24:MI') AS hora,
         r.activo, r.creado_en
    FROM recordatorios r
    JOIN habitos h ON h.id = r.habito_id`;

/** Los de hábitos archivados no se listan (vuelven si se restaura el hábito). */
export async function findAllByUsuario(usuarioId: number): Promise<Reminder[]> {
  const r = await query<Reminder>(
    `${SELECT_FROM} WHERE r.usuario_id = $1 AND h.activo ORDER BY r.hora, r.id`,
    [usuarioId],
  );
  return r.rows;
}

export async function findByIdForUsuario(id: number, usuarioId: number): Promise<Reminder | null> {
  const r = await query<Reminder>(`${SELECT_FROM} WHERE r.id = $1 AND r.usuario_id = $2`, [id, usuarioId]);
  return r.rows[0] ?? null;
}

export async function createReminder(
  usuarioId: number,
  habitoId: number,
  hora: string,
  activo: boolean,
): Promise<number> {
  const r = await query<{ id: number }>(
    `INSERT INTO recordatorios (usuario_id, habito_id, hora, activo)
     VALUES ($1, $2, $3::time, $4)
     RETURNING id`,
    [usuarioId, habitoId, hora, activo],
  );
  return r.rows[0]!.id;
}

export async function updateReminder(
  id: number,
  usuarioId: number,
  fields: { hora?: string; activo?: boolean },
): Promise<boolean> {
  const r = await query(
    `UPDATE recordatorios
        SET hora = COALESCE($3::time, hora),
            activo = COALESCE($4, activo)
      WHERE id = $1 AND usuario_id = $2`,
    [id, usuarioId, fields.hora ?? null, fields.activo ?? null],
  );
  return (r.rowCount ?? 0) > 0;
}

export async function deleteReminder(id: number, usuarioId: number): Promise<boolean> {
  const r = await query('DELETE FROM recordatorios WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
  return (r.rowCount ?? 0) > 0;
}
