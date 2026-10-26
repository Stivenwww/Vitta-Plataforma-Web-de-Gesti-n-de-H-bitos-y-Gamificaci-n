export type HabitTipo = 'predefinido' | 'personalizado';

export interface Habit {
  id: number;
  usuario_id: number;
  nombre: string;
  meta: string;
  frecuencia: string;
  tipo: HabitTipo;
  categoria: string | null;
  icono: string | null;
  /** Meta numérica (p. ej. 8 vasos); null si el hábito es solo sí/no. */
  meta_valor: number | null;
  unidad: string | null;
  /** false = archivado: conserva su historial pero no aparece en los listados. */
  activo: boolean;
  archivado_en: string | null;
  creado_en: string;
}
