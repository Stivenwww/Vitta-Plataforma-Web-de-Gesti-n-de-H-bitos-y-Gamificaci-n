/**
 * Aplica el esquema versionado y los catálogos en UNA transacción.
 * Uso:  npm run migrate
 * Ambos archivos son idempotentes: correrlo varias veces no duplica tablas,
 * columnas ni filas de catálogo. Si algo falla no queda nada a medias.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { pool, withTransaction } from './pool';

export async function migrate(): Promise<void> {
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  const catalogos = readFileSync(join(__dirname, 'catalogos.sql'), 'utf8');
  await withTransaction(async (client) => {
    await client.query(schema);
    await client.query(catalogos);
  });
}

if (require.main === module) {
  migrate()
    .then(() => console.log('Migración aplicada (schema.sql + catalogos.sql).'))
    .catch((err) => {
      console.error('Error en la migración:', err instanceof Error ? err.message : err);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
