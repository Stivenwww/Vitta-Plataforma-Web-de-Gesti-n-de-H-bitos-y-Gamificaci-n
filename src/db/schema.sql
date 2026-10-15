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

-- 
-- Modelo completo: logros, VitaPuntos, bitácora y hábitos ampliados
-- (agregar AL FINAL de src/db/schema.sql; es idempotente)
-- Convenciones: TEXT + CHECK, TIMESTAMPTZ, historial sin CASCADE.
-- 

-- 1) Bitácora: qué leyó, qué ejercicio hizo, qué estudió, etc.
ALTER TABLE registros_diarios
  ADD COLUMN IF NOT EXISTS reflexion TEXT NULL;

-- 2) Catálogo de logros
CREATE TABLE IF NOT EXISTS logros (
  id           SERIAL PRIMARY KEY,
  nombre       TEXT NOT NULL UNIQUE CHECK (char_length(btrim(nombre)) > 0),
  descripcion  TEXT NOT NULL DEFAULT '',
  icono        TEXT NULL,
  condicion    TEXT NOT NULL CHECK (char_length(btrim(condicion)) > 0),
  puntos_bonus INTEGER NOT NULL DEFAULT 0 CHECK (puntos_bonus >= 0),
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) Logros obtenidos por cada usuario (N a M)
CREATE TABLE IF NOT EXISTS usuario_logros (
  id             SERIAL PRIMARY KEY,
  usuario_id     INTEGER NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  logro_id       INTEGER NOT NULL REFERENCES logros (id) ON DELETE RESTRICT,
  obtenido_en    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_usuario_logro UNIQUE (usuario_id, logro_id)
);
CREATE INDEX IF NOT EXISTS idx_usuario_logros_usuario
  ON usuario_logros (usuario_id);

-- 4) Historial de VitaPuntos (log: sin CASCADE)
CREATE TABLE IF NOT EXISTS movimientos_puntos (
  id         SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios (id) ON DELETE RESTRICT,
  puntos     INTEGER NOT NULL CHECK (puntos <> 0),
  motivo     TEXT NOT NULL CHECK (char_length(btrim(motivo)) > 0),
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_movimientos_puntos_usuario_fecha
  ON movimientos_puntos (usuario_id, creado_en DESC);

-- 5) Hábitos más completos (todas opcionales para no romper lo existente)
ALTER TABLE habitos
  ADD COLUMN IF NOT EXISTS categoria         TEXT NULL,
  ADD COLUMN IF NOT EXISTS icono             TEXT NULL,
  ADD COLUMN IF NOT EXISTS meta_valor        NUMERIC NULL CHECK (meta_valor > 0),
  ADD COLUMN IF NOT EXISTS unidad            TEXT NULL,
  ADD COLUMN IF NOT EXISTS dias_semana       SMALLINT[] NULL
    CHECK (dias_semana <@ ARRAY[1,2,3,4,5,6,7]::SMALLINT[]),  -- 1=lunes ... 7=domingo
  ADD COLUMN IF NOT EXISTS hora_recordatorio TIME NULL,
  ADD COLUMN IF NOT EXISTS activo            BOOLEAN NOT NULL DEFAULT TRUE;

-- 6) (Opcional) Plantillas de hábitos predefinidos
CREATE TABLE IF NOT EXISTS plantillas_habitos (
  id                   SERIAL PRIMARY KEY,
  nombre               TEXT NOT NULL UNIQUE CHECK (char_length(btrim(nombre)) > 0),
  categoria            TEXT NULL,
  icono                TEXT NULL,
  meta_valor_sugerida  NUMERIC NULL CHECK (meta_valor_sugerida > 0),
  unidad               TEXT NULL
);


-- =========================================================
-- HAB-123: evitar puntos duplicados por el mismo cumplimiento
-- (agregar AL FINAL de src/db/schema.sql; es idempotente)
-- =========================================================

-- Cada movimiento de puntos puede ligarse al registro diario que lo originó.
ALTER TABLE movimientos_puntos
  ADD COLUMN IF NOT EXISTS registro_id INTEGER NULL
    REFERENCES registros_diarios (id) ON DELETE RESTRICT;

-- Un mismo registro no puede generar dos veces el mismo tipo de movimiento.
-- (Parcial: los movimientos sin registro, p. ej. bonus de logros, no se ven afectados.)
CREATE UNIQUE INDEX IF NOT EXISTS uq_movimientos_puntos_registro_motivo
  ON movimientos_puntos (registro_id, motivo)
  WHERE registro_id IS NOT NULL;