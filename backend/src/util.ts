import { redisClient } from "./redis.js";
import type { AttackResult, Hit, HitsEnumType, PlacedShip } from "./types.js";
import { HitsEnum } from "./types.js";

export async function verifyAttack(
  lobbyId: string,
  target: Hit,
  hitsStr: string,
  defenderPrefix: string
): Promise<AttackResult> {
  // Validate grid bounds (10x10 grid, 0-indexed)
  if (target.row < 0 || target.row > 9 || target.col < 0 || target.col > 9) {
    return {
      valid: false,
      hit: false,
      error: "Attack coordinates out of bounds (must be 0-9)",
    };
  }

  // Get defender's ships

  const shipsStr = await redisClient.hGet(
    `lobby:${lobbyId}`,
    `${defenderPrefix}Ships`
  );

  const defenderShips: PlacedShip[] = shipsStr ? JSON.parse(shipsStr) : [];
  const attackerHits: Hit[] = hitsStr ? JSON.parse(hitsStr) : [];

  // Check if this cell was already attacked
  const alreadyAttacked = attackerHits.some(
    (hit) => hit.row === target.row && hit.col === target.col
  );

  if (alreadyAttacked) {
    return {
      valid: false,
      hit: false,
      error: "Cell already attacked",
    };
  }

  // Check if target hits any ship
  for (const ship of defenderShips) {
    const isHit = ship.cells.some(
      (cell) => cell.row === target.row && cell.col === target.col
    );

    if (isHit) {
      // Check if ship is sunk (all cells have been hit)
      const allHits = [...attackerHits, target];
      const shipHitCount = ship.cells.filter((cell) =>
        allHits.some((hit) => hit.row === cell.row && hit.col === cell.col)
      ).length;

      const isSunk = shipHitCount === ship.cells.length;

      return {
        valid: true,
        hit: true,
        shipId: ship.id,
        shipName: ship.name,
        sunk: isSunk,
        shipCells: isSunk ? ship.cells : undefined,
      };
    }
  }

  return { valid: true, hit: false };
}

export function generateHitBoard(
  playerHits: Hit[],
  enemyShips: PlacedShip[],
  enemySunks: number[]
) {
  const hitsArray = Array.from({ length: 10 }, () =>
    Array.from<HitsEnumType>({ length: 10 }).fill(HitsEnum.Default)
  );

  for (const hit of playerHits) {
    let shipHit = false;
    shipsLoop: for (const ship of enemyShips) {
      for (const cell of ship.cells) {
        if (cell.col === hit.col && cell.row === hit.row) {
          if (enemySunks.includes(ship.id)) {
            hitsArray[hit.row][hit.col] = HitsEnum.Ship;
          } else {
            hitsArray[hit.row][hit.col] = HitsEnum.Hit;
          }

          shipHit = true;
          break;
        }
      }
    }
    if (!shipHit) {
      hitsArray[hit.row][hit.col] = HitsEnum.Miss;
    }
  }

  return hitsArray;
}
