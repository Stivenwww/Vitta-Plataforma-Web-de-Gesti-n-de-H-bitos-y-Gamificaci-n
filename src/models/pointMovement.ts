export interface PointMovement {
  id: number;
  usuario_id: number;
  registro_id: number | null;
  puntos: number;
  motivo: string;
  /** Instante UTC en ISO 8601. */
  creado_en: string;
}

export interface UserPoints {
  /** VitaPuntos acumulados (el nivel depende de lo acumulado, no del saldo). */
  puntos_totales: number;
  nivel: number;
  nombre_nivel: string;
  /** Puntos acumulados dentro del nivel actual. */
  puntos_en_nivel: number;
  /** Puntos que faltan para el siguiente nivel; null en el nivel máximo. */
  puntos_para_siguiente: number | null;
  /** Puntos totales donde empieza el siguiente nivel; null en el nivel máximo. */
  puntos_nivel_siguiente: number | null;
}
