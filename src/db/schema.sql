-- Vitta (HÁBITOS+) — esquema inicial HU-13 → HU-16
-- PostgreSQL. Solo DDL versionado, sin datos. Idempotente: se puede
-- aplicar sobre una BD vacía o sobre cualquier versión anterior.
--   npm run migrate        (aplica este archivo + catalogos.sql en una transacción)
--   psql $DATABASE_URL -v ON_ERROR_STOP=1 -1 -f src/db/schema.sql
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
-- HU-15 fechas (D-07, D-09): `fecha` es el instante del registro
-- (TIMESTAMPTZ, ISO 8601 UTC). `dia` es el día calendario LOCAL del usuario
-- al que pertenece el registro (America/Bogota por defecto, o la zona del
-- encabezado X-Timezone), calculado por el servidor al guardar. Rachas,
-- progreso y unicidad "mismo hábito + mismo día" (HU-15 CA-03) usan `dia`,
-- así un registro hecho a las 8 p. m. en Colombia no cae en el día siguiente.
CREATE TABLE IF NOT EXISTS registros_diarios (
  id        SERIAL PRIMARY KEY,
  habito_id INTEGER NOT NULL REFERENCES habitos (id) ON DELETE RESTRICT,
  fecha     TIMESTAMPTZ NOT NULL,
  dia       DATE NOT NULL,
  cumplido  BOOLEAN NOT NULL,
  valor     NUMERIC NULL
);

-- Migración de BDs anteriores (2026-10-26, D-09) -----------------------------
ALTER TABLE registros_diarios ADD COLUMN IF NOT EXISTS dia DATE NULL;

-- a) BDs creadas con `fecha DATE`: ese día ya era el día del usuario.
--    El instante se fija al mediodía de Bogotá para que `dia` y `fecha`
--    coincidan en la zona por defecto.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'registros_diarios'
      AND column_name = 'fecha'
      AND udt_name = 'date'
  ) THEN
    UPDATE registros_diarios SET dia = fecha WHERE dia IS NULL;
    ALTER TABLE registros_diarios
      DROP CONSTRAINT IF EXISTS registros_diarios_habito_id_fecha_key;
    ALTER TABLE registros_diarios
      ALTER COLUMN fecha TYPE TIMESTAMPTZ
      USING ((fecha::timestamp + TIME '12:00') AT TIME ZONE 'America/Bogota');
  END IF;
END $$;

-- b) BDs con `fecha TIMESTAMPTZ` (D-07): un instante a medianoche UTC exacta
--    venía de un `YYYY-MM-DD` enviado por el cliente → ese día; cualquier
--    otro instante se ubica en el día de Bogotá.
UPDATE registros_diarios
   SET dia = CASE
               WHEN (fecha AT TIME ZONE 'UTC')::time = TIME '00:00'
                 THEN (fecha AT TIME ZONE 'UTC')::date
               ELSE (fecha AT TIME ZONE 'America/Bogota')::date
             END
 WHERE dia IS NULL;
ALTER TABLE registros_diarios ALTER COLUMN dia SET NOT NULL;

-- La unicidad por día UTC queda reemplazada por la del día local.
DROP INDEX IF EXISTS uq_registros_habito_dia_utc;
ALTER TABLE registros_diarios
  DROP CONSTRAINT IF EXISTS registros_diarios_habito_id_fecha_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_registros_habito_dia
  ON registros_diarios (habito_id, dia);
CREATE INDEX IF NOT EXISTS idx_registros_habito_fecha
  ON registros_diarios (habito_id, fecha);

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

-- =========================================================
-- 2026-10-26 — Logros automáticos, archivado, recordatorios, perfil
-- (D-09 … D-13 en DECISIONES.md; idempotente)
-- =========================================================

-- Logros: condición estructurada para evaluarlos y mostrar progreso.
--   criterio: 'cumplimientos' (registros cumplidos de hábitos que encajan
--             con `filtro`, o de todos si filtro es NULL), 'dias' (días
--             distintos con al menos uno de esos registros), 'racha' (racha
--             máxima de cualquier hábito), 'areas_semana' (categorías
--             distintas cumplidas dentro de una misma semana lunes–domingo).
--   filtro:   palabras clave normalizadas (minúsculas, sin tildes) que se
--             comparan con icono, categoría, nombre o unidad del hábito.
ALTER TABLE logros
  ADD COLUMN IF NOT EXISTS criterio      TEXT NULL
    CHECK (criterio IN ('cumplimientos', 'dias', 'racha', 'areas_semana')),
  ADD COLUMN IF NOT EXISTS filtro        TEXT[] NULL,
  ADD COLUMN IF NOT EXISTS progreso_meta INTEGER NULL CHECK (progreso_meta > 0);

-- Bono de VitaPuntos de un logro: un único movimiento por usuario y logro.
ALTER TABLE movimientos_puntos
  ADD COLUMN IF NOT EXISTS logro_id INTEGER NULL
    REFERENCES logros (id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_movimientos_puntos_usuario_logro
  ON movimientos_puntos (usuario_id, logro_id)
  WHERE logro_id IS NOT NULL;

-- Archivado lógico (D-11): `activo = FALSE` ya excluía el hábito del
-- dashboard; `archivado_en` permite seguir contando su historial en los
-- días anteriores al archivado.
ALTER TABLE habitos
  ADD COLUMN IF NOT EXISTS archivado_en TIMESTAMPTZ NULL;

-- Recordatorios (D-12). Son configuración, no historial: se borran con el
-- hábito o el usuario.
CREATE TABLE IF NOT EXISTS recordatorios (
  id         SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  habito_id  INTEGER NOT NULL REFERENCES habitos (id) ON DELETE CASCADE,
  hora       TIME NOT NULL,
  activo     BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_recordatorios_habito_hora UNIQUE (habito_id, hora)
);
CREATE INDEX IF NOT EXISTS idx_recordatorios_usuario
  ON recordatorios (usuario_id);

-- Perfil (D-13): versión de credenciales para invalidar tokens emitidos
-- antes de un cambio de contraseña.
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

-- Correo único sin distinguir mayúsculas. Si ya hubiera duplicados que solo
-- difieren en mayúsculas no se crea el índice (hay que resolverlos a mano);
-- la restricción UNIQUE (correo) original sigue vigente.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM usuarios GROUP BY lower(correo) HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_correo_lower
      ON usuarios (lower(correo));
  ELSE
    RAISE NOTICE 'uq_usuarios_correo_lower no creado: hay correos duplicados sin distinguir mayúsculas';
  END IF;
END $$;
