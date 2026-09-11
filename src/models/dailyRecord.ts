export interface DailyRecord {
  id: number;
  habito_id: number;
  /** Instante UTC en ISO 8601 (ej. `2026-09-11T04:55:32.000Z`).
   *  La zona horaria se resuelve en presentación. */
  fecha: string;
  cumplido: boolean;
  valor: string | number | null;
}
