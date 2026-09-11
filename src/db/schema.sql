-- Vitta (HÁBITOS+) — esquema inicial HU-13 → HU-16
-- PostgreSQL. Solo DDL versionado, sin datos. Migración manual:
--   psql $DATABASE_URL -f src/db/schema.sql
-- Decisiones: DECISIONES.md §2 (D-02, D-03, D-06). Sin ORM, sin Prisma.
-- Convenciones: PK SERIAL, FK con integridad referencial, UNIQUE donde
-- exigen los diagramas, TIMESTAMPTZ en UTC (ISO 8601) para fechas con hora,
-- sin ON DELETE CASCADE hacia logs.

CREATE TABLE IF NOT EXISTS usuarios (
  id            SERIAL PRIMARY KEY,
  nombre        TEXT NOT NULL CHECK (char_length(btrim(nombre)) > 0),
  correo        TEXT NOT NULL UNIQUE CHECK (correo LIKE '%@%.%'),
  password_hash TEXT NOT NULL,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS habitos (
  id         SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  nombre     TEXT NOT NULL CHECK (char_length(btrim(nombre)) > 0),
  meta       TEXT NOT NULL CHECK (char_length(btrim(meta)) > 0),
  frecuencia TEXT NOT NULL CHECK (char_length(btrim(frecuencia)) > 0),
  tipo       TEXT NOT NULL DEFAULT 'personalizado'
             CHECK (tipo IN ('predefinido', 'personalizado')),
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_habitos_usuario ON habitos (usuario_id);

-- Historial intacto al borrar hábito (HU-14 CA-03): SIN on delete cascade.
-- HU-15 corrección fechas (2026-09-11, D-07): la fecha se almacena como
-- TIMESTAMPTZ en UTC con fecha y hora completa (ISO 8601, ej.
-- 2026-09-11T04:55:32Z). Nunca como texto ni con AM/PM. La zona horaria
-- se resuelve en presentación. La unicidad "mismo hábito + misma fecha"
-- (HU-15 CA-03) se aplica por día calendario UTC mediante el índice
-- uq_registros_habito_dia_utc, de modo que dos horas del mismo día no
-- duplican el registro.
CREATE TABLE IF NOT EXISTS registros_diarios (
  id        SERIAL PRIMARY KEY,
  habito_id INTEGER NOT NULL REFERENCES habitos (id) ON DELETE RESTRICT,
  fecha     TIMESTAMPTZ NOT NULL,
  cumplido  BOOLEAN NOT NULL,
  valor     NUMERIC NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_registros_habito_dia_utc
  ON registros_diarios (habito_id, ((fecha AT TIME ZONE 'UTC')::date));
CREATE INDEX IF NOT EXISTS idx_registros_habito_fecha
  ON registros_diarios (habito_id, fecha);

-- Migración para BDs creadas con fecha DATE: convierte la columna a
-- TIMESTAMPTZ interpretando el día existente como medianoche UTC.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'registros_diarios'
      AND column_name = 'fecha'
      AND udt_name = 'date'
  ) THEN
    ALTER TABLE registros_diarios
      DROP CONSTRAINT IF EXISTS registros_diarios_habito_id_fecha_key;
    ALTER TABLE registros_diarios
      ALTER COLUMN fecha TYPE TIMESTAMPTZ
      USING ((fecha::timestamp) AT TIME ZONE 'UTC');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS rachas (
  habito_id     INTEGER PRIMARY KEY REFERENCES habitos (id) ON DELETE CASCADE,
  racha_actual  INTEGER NOT NULL DEFAULT 0 CHECK (racha_actual >= 0),
  racha_maxima  INTEGER NOT NULL DEFAULT 0 CHECK (racha_maxima >= 0),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
