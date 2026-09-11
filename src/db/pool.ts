import { Pool, type QueryResult, type QueryResultRow } from 'pg';
import { config } from '../config/env';

export const pool = new Pool(
  config.databaseUrl ? { connectionString: config.databaseUrl } : {},
);

pool.on('error', (err) => {
  console.error('[vitta] error inesperado en el pool de PostgreSQL:', err);
});

export async function query<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}
