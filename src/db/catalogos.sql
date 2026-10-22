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
INSERT INTO logros (nombre, descripcion, icono, condicion, puntos_bonus) VALUES
  ('Primer Brote',        'Tu primer hábito completado.',                 'primer_brote',      'Completar el primer hábito',              30),
  ('Mente Curiosa',       'Siete sesiones de lectura.',                   'mente_curiosa',     '7 sesiones de lectura',                   50),
  ('Lector Constante',    'Treinta sesiones de lectura.',                 'lector_constante',  '30 sesiones de lectura',                  100),
  ('En Equilibrio',       'Cuidas varias áreas de tu bienestar.',         'en_equilibrio',     'Hábitos de 3 áreas en una semana',        100),
  ('Amanecer Vita',       'Te levantas temprano con constancia.',         'amanecer_vita',     'Levantarse temprano 7 veces',             70),
  ('Paso a Paso',         'Cumples tu meta de pasos durante una semana.', 'paso_a_paso',       'Meta de pasos 7 días',                    70),
  ('Alma Zen',            'Siete sesiones de yoga.',                      'alma_zen',          '7 sesiones de yoga',                      70),
  ('Cuerpo Activo',       'Diez sesiones de actividad física.',           'cuerpo_activo',     '10 sesiones de actividad física',         100),
  ('Plato en Equilibrio', 'Cumples tu objetivo de alimentación.',         'plato_equilibrio',  'Objetivo de alimentación 7 días',         70),
  ('Tiempo para Mí',      'Siete sesiones de autocuidado.',               'tiempo_para_mi',    '7 sesiones de autocuidado',               70),
  ('Primer Impulso',      'Racha de 7 días.',                             'racha_7',           'Racha de 7 días',                         50),
  ('Constancia Vita',     'Racha de 30 días.',                            'racha_30',          'Racha de 30 días',                        100),
  ('Ritmo Vita',          'Racha de 50 días.',                            'racha_50',          'Racha de 50 días',                        150),
  ('Espíritu Vita',       'Racha de 100 días (recompensa especial).',     'racha_100',         'Racha de 100 días',                       300)
ON CONFLICT (nombre) DO NOTHING;
