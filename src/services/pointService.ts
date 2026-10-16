import {
  getTotalPoints as repoTotal,
  insertMovementForRecord as repoInsert,
  listMovements as repoList,
} from '../repositories/pointRepository';
import type { PointMovement, UserPoints } from '../models/pointMovement';

// Especificación UX y Producto v2.0, §6.3 (VitaPuntos) y §6.4 (Niveles).
export const PUNTOS_POR_CUMPLIMIENTO = 10;

export const NIVELES: ReadonlyArray<{ nivel: number; nombre: string; desde: number }> = [
  { nivel: 1, nombre: 'Inicio', desde: 0 },
  { nivel: 2, nombre: 'Explorador', desde: 100 },
  { nivel: 3, nombre: 'Constante', desde: 250 },
  { nivel: 4, nombre: 'En Equilibrio', desde: 500 },
  { nivel: 5, nombre: 'Impulsor', desde: 1000 },
  { nivel: 6, nombre: 'Maestro de la Constancia', desde: 2000 },
];
export const MOTIVO_HABITO_CUMPLIDO = 'habito_cumplido';

export interface PointDependencies {
  insertMovement: (
    usuarioId: number,
    registroId: number,
    puntos: number,
    motivo: string,
  ) => Promise<boolean>;
  getTotal: (usuarioId: number) => Promise<number>;
  listMovements: (usuarioId: number, limit: number) => Promise<PointMovement[]>;
}

const defaultDependencies: PointDependencies = {
  insertMovement: repoInsert,
  getTotal: repoTotal,
  listMovements: repoList,
};

/**
 * HAB-124: nivel según los VitaPuntos acumulados (spec v2.0 §6.4).
 * Pura: sin E/S, testeable sin BD.
 */
export function computeLevel(puntosTotales: number): UserPoints {
  const total = Math.max(0, Math.floor(puntosTotales));
  let idx = 0;
  for (let i = 0; i < NIVELES.length; i += 1) {
    if (total >= NIVELES[i]!.desde) {
      idx = i;
    }
  }
  const actual = NIVELES[idx]!;
  const siguiente = NIVELES[idx + 1];
  return {
    puntos_totales: total,
    nivel: actual.nivel,
    nombre_nivel: actual.nombre,
    puntos_en_nivel: total - actual.desde,
    puntos_para_siguiente: siguiente ? siguiente.desde - total : null,
    puntos_nivel_siguiente: siguiente ? siguiente.desde : null,
  };
}

/**
 * HAB-125: otorga puntos cuando un registro queda cumplido.
 * HAB-123: es idempotente por registro; devuelve los puntos sumados
 * (0 si ese registro ya había dado puntos).
 */
export async function awardPointsForRecord(
  usuarioId: number,
  registroId: number,
  deps: PointDependencies = defaultDependencies,
): Promise<number> {
  const inserted = await deps.insertMovement(
    usuarioId,
    registroId,
    PUNTOS_POR_CUMPLIMIENTO,
    MOTIVO_HABITO_CUMPLIDO,
  );
  return inserted ? PUNTOS_POR_CUMPLIMIENTO : 0;
}

/** HAB-122: puntos y nivel del usuario autenticado. */
export async function getUserPoints(
  usuarioId: number,
  deps: PointDependencies = defaultDependencies,
): Promise<UserPoints> {
  return computeLevel(await deps.getTotal(usuarioId));
}

/** HAB-34: historial de movimientos (más recientes primero). */
export async function getUserMovements(
  usuarioId: number,
  limitRaw: unknown,
  deps: PointDependencies = defaultDependencies,
): Promise<PointMovement[]> {
  const parsed = typeof limitRaw === 'string' ? Number(limitRaw) : NaN;
  const limit = Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 100) : 50;
  return deps.listMovements(usuarioId, limit);
}
