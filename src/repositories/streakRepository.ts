import { query } from '../db/pool';
import type { Streak } from '../models/streak';

const SELECT_COLS = 'habito_id, racha_actual, racha_maxima';

export async function findByHabit(habitoId: number): Promise<Streak | null> {
  const result = await query<Streak>(
    `SELECT ${SELECT_COLS} FROM rachas WHERE habito_id = $1`,
    [habitoId],
  );
  return result.rows[0] ?? null;
}

export async function upsertStreak(
  habitoId: number,
  rachaActual: number,
  rachaMaxima: number,
): Promise<Streak> {
  const result = await query<Streak>(
    `INSERT INTO rachas (habito_id, racha_actual, racha_maxima, actualizado_en)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (habito_id)
     DO UPDATE SET racha_actual = EXCLUDED.racha_actual,
                   racha_maxima = EXCLUDED.racha_maxima,
                   actualizado_en = now()
     RETURNING ${SELECT_COLS}`,
    [habitoId, rachaActual, rachaMaxima],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('No se pudo actualizar la racha');
  }
  return row;
}
