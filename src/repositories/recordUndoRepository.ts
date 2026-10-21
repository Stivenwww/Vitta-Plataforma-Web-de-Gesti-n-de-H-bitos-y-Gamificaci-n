import { pool } from '../db/pool';

/**
 * Desmarcar un hábito: borra el registro diario y, en la misma transacción,
 * el movimiento de VitaPuntos que ese registro había generado (la FK
 * movimientos_puntos.registro_id es ON DELETE RESTRICT, así que primero va
 * el movimiento). Sin puntos negativos: el saldo baja porque el movimiento
 * deja de existir (spec v2.0 §6.3 y §8.3). Devuelve false si no existía.
 */
export async function deleteRecordAndPoints(
  registroId: number,
  habitoId: number,
): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `DELETE FROM movimientos_puntos
        WHERE registro_id IN (
          SELECT id FROM registros_diarios WHERE id = $1 AND habito_id = $2
        )`,
      [registroId, habitoId],
    );
    const result = await client.query(
      'DELETE FROM registros_diarios WHERE id = $1 AND habito_id = $2',
      [registroId, habitoId],
    );
    await client.query('COMMIT');
    return (result.rowCount ?? 0) > 0;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
