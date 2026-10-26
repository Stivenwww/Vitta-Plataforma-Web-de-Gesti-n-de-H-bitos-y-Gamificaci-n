-- Catálogos de la app (datos que Vitta necesita desde el primer día).
-- se puede correr varias veces sin duplicar.
--   psql $DATABASE_URL -f src/db/catalogos.sql

-- Plantillas de hábitos predefinidos (§5.2)
INSERT INTO plantillas_habitos (nombre, categoria, icono, meta_valor_sugerida, unidad) VALUES
  ('Tomar agua',          'Hidratación',  'water',    8,    'vasos'),
  ('Dormir',              'Descanso',     'sleep',    7,    'horas'),
  ('Caminar',             'Movimiento',   'walk',     6000, 'pasos'),
  ('Hacer yoga',          'Bienestar',    'yoga',     10,   'minutos'),
  ('Meditar',             'Bienestar',    'meditate', 10,   'minutos'),
  ('Leer',                'Lectura',      'book',     20,   'minutos'),
  ('Comer saludable',     'Alimentación', 'salad',    3,    'comidas balanceadas'),
  ('Comer fruta',         'Alimentación', 'fruit',    2,    'porciones'),
  ('Levantarse temprano', 'Descanso',     'sunrise',  NULL, NULL),
  ('Ejercicio',           'Movimiento',   'fitness',  30,   'minutos')
ON CONFLICT (nombre) DO NOTHING;

-- Logros e insignias (§6.5) y rachas (§6.2). El bono es en VitaPuntos.
-- criterio / filtro / progreso_meta: ver schema.sql (D-10). ON CONFLICT
-- actualiza solo la condición, para que bases existentes la reciban.
INSERT INTO logros (nombre, descripcion, icono, condicion, puntos_bonus, criterio, filtro, progreso_meta) VALUES
  ('Primer Brote',        'Tu primer hábito completado.',                 'primer_brote',      'Completar el primer hábito',              30,  'cumplimientos', NULL, 1),
  ('Mente Curiosa',       'Siete sesiones de lectura.',                   'mente_curiosa',     '7 sesiones de lectura',                   50,  'cumplimientos', ARRAY['book','lectura','leer'], 7),
  ('Lector Constante',    'Treinta sesiones de lectura.',                 'lector_constante',  '30 sesiones de lectura',                  100, 'cumplimientos', ARRAY['book','lectura','leer'], 30),
  ('En Equilibrio',       'Cuidas varias áreas de tu bienestar.',         'en_equilibrio',     'Hábitos de 3 áreas en una semana',        100, 'areas_semana',  NULL, 3),
  ('Amanecer Vita',       'Te levantas temprano con constancia.',         'amanecer_vita',     'Levantarse temprano 7 veces',             70,  'cumplimientos', ARRAY['sunrise','levantarse temprano','madrugar'], 7),
  ('Paso a Paso',         'Cumples tu meta de pasos durante una semana.', 'paso_a_paso',       'Meta de pasos 7 días',                    70,  'dias',          ARRAY['walk','caminar','pasos'], 7),
  ('Alma Zen',            'Siete sesiones de yoga.',                      'alma_zen',          '7 sesiones de yoga',                      70,  'cumplimientos', ARRAY['yoga','hacer yoga'], 7),
  ('Cuerpo Activo',       'Diez sesiones de actividad física.',           'cuerpo_activo',     '10 sesiones de actividad física',         100, 'cumplimientos', ARRAY['fitness','walk','movimiento','ejercicio','caminar','actividad fisica'], 10),
  ('Plato en Equilibrio', 'Cumples tu objetivo de alimentación.',         'plato_equilibrio',  'Objetivo de alimentación 7 días',         70,  'dias',          ARRAY['salad','fruit','alimentacion','comer saludable','comer fruta'], 7),
  ('Tiempo para Mí',      'Siete sesiones de autocuidado.',               'tiempo_para_mi',    '7 sesiones de autocuidado',               70,  'cumplimientos', ARRAY['meditate','yoga','bienestar','autocuidado','meditar','hacer yoga'], 7),
  ('Primer Impulso',      'Racha de 7 días.',                             'racha_7',           'Racha de 7 días',                         50,  'racha',         NULL, 7),
  ('Constancia Vita',     'Racha de 30 días.',                            'racha_30',          'Racha de 30 días',                        100, 'racha',         NULL, 30),
  ('Ritmo Vita',          'Racha de 50 días.',                            'racha_50',          'Racha de 50 días',                        150, 'racha',         NULL, 50),
  ('Espíritu Vita',       'Racha de 100 días (recompensa especial).',     'racha_100',         'Racha de 100 días',                       300, 'racha',         NULL, 100)
ON CONFLICT (nombre) DO UPDATE
  SET criterio      = EXCLUDED.criterio,
      filtro        = EXCLUDED.filtro,
      progreso_meta = EXCLUDED.progreso_meta;
