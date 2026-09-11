export type HabitTipo = 'predefinido' | 'personalizado';

export interface Habit {
  id: number;
  usuario_id: number;
  nombre: string;
  meta: string;
  frecuencia: string;
  tipo: HabitTipo;
  creado_en: string;
}
