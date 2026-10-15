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
  puntos_totales: number;
  nivel: number;
  /** Puntos acumulados dentro del nivel actual (0 .. PUNTOS_POR_NIVEL - 1). */
  puntos_en_nivel: number;
  /** Puntos que faltan para subir al siguiente nivel. */
  puntos_para_siguiente: number;
}
