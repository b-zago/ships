import { redisClient } from "./redis.js";
import type { AttackResult, Hit, HitsEnumType, PlacedShip } from "./types.js";
import { HitsEnum } from "./types.js";
import { safeRedisOperation } from "./redis-utils.js";

const GRID_SIZE = 10;

// Define valid ships
const VALID_SHIPS = [
  { id: 1, name: "Carrier", length: 5 },
  { id: 2, name: "Battleship", length: 4 },
  { id: 3, name: "Cruiser", length: 3 },
  { id: 4, name: "Submarine", length: 3 },
  { id: 5, name: "Destroyer", length: 2 },
];

interface ValidationResult {
  valid: boolean;
  error?: string;
}

export async function verifyAttack(
  lobbyId: string,
  target: Hit,
  hitsStr: string,
  defenderPrefix: string,
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
  const shipsStr = await safeRedisOperation(
    async () =>
      await redisClient.hGet(`lobby:${lobbyId}`, `${defenderPrefix}Ships`),
    "Failed to get defender ships",
  );

  const defenderShips: PlacedShip[] = shipsStr ? JSON.parse(shipsStr) : [];
  const attackerHits: Hit[] = hitsStr ? JSON.parse(hitsStr) : [];

  // Check if this cell was already attacked
  const alreadyAttacked = attackerHits.some(
    (hit) => hit.row === target.row && hit.col === target.col,
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
      (cell) => cell.row === target.row && cell.col === target.col,
    );

    if (isHit) {
      // Check if ship is sunk (all cells have been hit)
      const allHits = [...attackerHits, target];
      const shipHitCount = ship.cells.filter((cell) =>
        allHits.some((hit) => hit.row === cell.row && hit.col === cell.col),
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
  enemySunks: number[],
) {
  const hitsArray = Array.from({ length: 10 }, () =>
    Array.from<HitsEnumType>({ length: 10 }).fill(HitsEnum.Default),
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
          break shipsLoop;
        }
      }
    }
    if (!shipHit) {
      hitsArray[hit.row][hit.col] = HitsEnum.Miss;
    }
  }

  return hitsArray;
}

export function validateShipPlacement(ships: PlacedShip[]): ValidationResult {
  // Check if exactly 5 ships are placed
  if (ships.length !== 5) {
    return {
      valid: false,
      error: `Must place exactly 5 ships, got ${ships.length}`,
    };
  }

  // Check if all ship IDs are unique and valid
  const shipIds = ships.map((s) => s.id).sort();
  const expectedIds = VALID_SHIPS.map((s) => s.id).sort();

  if (JSON.stringify(shipIds) !== JSON.stringify(expectedIds)) {
    return {
      valid: false,
      error: "Invalid ship configuration - must have one of each ship type",
    };
  }

  // Validate each ship
  for (const ship of ships) {
    // Find the expected ship definition
    const expectedShip = VALID_SHIPS.find((s) => s.id === ship.id);

    if (!expectedShip) {
      return {
        valid: false,
        error: `Invalid ship ID: ${ship.id}`,
      };
    }

    // Check ship name matches
    if (ship.name !== expectedShip.name) {
      return {
        valid: false,
        error: `Ship ${ship.id} has wrong name: expected ${expectedShip.name}, got ${ship.name}`,
      };
    }

    // Check ship length matches
    if (ship.length !== expectedShip.length) {
      return {
        valid: false,
        error: `Ship ${ship.name} has wrong length: expected ${expectedShip.length}, got ${ship.length}`,
      };
    }

    // Check if ship has correct number of cells
    if (ship.cells.length !== ship.length) {
      return {
        valid: false,
        error: `Ship ${ship.name} has ${ship.cells.length} cells but should have ${ship.length}`,
      };
    }

    // Check if all cells are within bounds
    for (const cell of ship.cells) {
      if (
        cell.row < 0 ||
        cell.row >= GRID_SIZE ||
        cell.col < 0 ||
        cell.col >= GRID_SIZE
      ) {
        return {
          valid: false,
          error: `Ship ${ship.name} has cell out of bounds: (${cell.row}, ${cell.col})`,
        };
      }
    }

    // Check if cells form a valid line (horizontal or vertical)
    const cellsSorted = [...ship.cells].sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row;
      return a.col - b.col;
    });

    if (ship.isHorizontal) {
      // All cells should have same row
      const firstRow = cellsSorted[0].row;
      if (!cellsSorted.every((cell) => cell.row === firstRow)) {
        return {
          valid: false,
          error: `Ship ${ship.name} marked as horizontal but cells are not in a row`,
        };
      }

      // Columns should be consecutive
      for (let i = 1; i < cellsSorted.length; i++) {
        if (cellsSorted[i].col !== cellsSorted[i - 1].col + 1) {
          return {
            valid: false,
            error: `Ship ${ship.name} has non-consecutive cells`,
          };
        }
      }
    } else {
      // All cells should have same column
      const firstCol = cellsSorted[0].col;
      if (!cellsSorted.every((cell) => cell.col === firstCol)) {
        return {
          valid: false,
          error: `Ship ${ship.name} marked as vertical but cells are not in a column`,
        };
      }

      // Rows should be consecutive
      for (let i = 1; i < cellsSorted.length; i++) {
        if (cellsSorted[i].row !== cellsSorted[i - 1].row + 1) {
          return {
            valid: false,
            error: `Ship ${ship.name} has non-consecutive cells`,
          };
        }
      }
    }
  }

  // Check for overlapping ships
  const occupiedCells = new Set<string>();

  for (const ship of ships) {
    for (const cell of ship.cells) {
      const cellKey = `${cell.row},${cell.col}`;

      if (occupiedCells.has(cellKey)) {
        return {
          valid: false,
          error: `Ships overlap at cell (${cell.row}, ${cell.col})`,
        };
      }

      occupiedCells.add(cellKey);
    }
  }

  return { valid: true };
}
