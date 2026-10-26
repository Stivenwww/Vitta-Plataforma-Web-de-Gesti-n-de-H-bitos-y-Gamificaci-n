export interface DailyRecord {
  id: number;
  habito_id: number;
  /** Instante UTC en ISO 8601 (ej. `2026-09-11T04:55:32.000Z`). */
  fecha: string;
  /** Día local del usuario al que pertenece el registro (`YYYY-MM-DD`). */
  dia: string;
  cumplido: boolean;
  /** Valor numérico del día; en hábitos con meta es el avance (parcial o total). */
  valor: number | null;
  /** Bitácora del día (columna `reflexion`). */
  notas: string | null;
}
