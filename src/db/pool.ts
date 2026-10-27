import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { config } from '../config/env';

export const pool = new Pool(
  config.databaseUrl ? { connectionString: config.databaseUrl } : {},
);

pool.on('error', (err) => {
  console.error('[vitta] error inesperado en el pool de PostgreSQL:', err);
});

/** Pool o cliente de una transacción: los repositorios aceptan cualquiera. */
export type Queryable = Pick<Pool | PoolClient, 'query'>;

export async function query<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

/** Ejecuta `fn` dentro de BEGIN/COMMIT; cualquier error hace ROLLBACK. */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
