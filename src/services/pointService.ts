import {
  getTotalPoints as repoTotal,
  insertMovementForRecord as repoInsert,
  listMovements as repoList,
} from '../repositories/pointRepository';
import type { PointMovement, UserPoints } from '../models/pointMovement';

// TODO(equipo): confirmar estos valores con la especificación / Jira.
export const PUNTOS_POR_CUMPLIMIENTO = 10;
export const PUNTOS_POR_NIVEL = 100;
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
 * HAB-124: nivel según puntos acumulados. Pura: sin E/S, testeable sin BD.
 * Nivel 1 desde 0 puntos; sube cada PUNTOS_POR_NIVEL puntos.
 */
export function computeLevel(puntosTotales: number): UserPoints {
  const total = Math.max(0, Math.floor(puntosTotales));
  const nivel = Math.floor(total / PUNTOS_POR_NIVEL) + 1;
  const enNivel = total % PUNTOS_POR_NIVEL;
  return {
    puntos_totales: total,
    nivel,
    puntos_en_nivel: enNivel,
    puntos_para_siguiente: PUNTOS_POR_NIVEL - enNivel,
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
