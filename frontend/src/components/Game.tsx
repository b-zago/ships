import React, { type SetStateAction } from "react";
import { HitsEnum } from "../routes/GameController";
import { useNavigate } from "react-router-dom";
import { Home } from "lucide-react";

const GRID_SIZE = 10;

interface Ship {
  id: number;
  name: string;
  length: number;
  color: string;
}

interface Cell {
  row: number;
  col: number;
}

interface PlacedShip extends Ship {
  cells: Cell[];
  isHorizontal: boolean;
}

interface GameProps {
  placedShips: PlacedShip[];
  onEnemyCellClick?: (row: number, col: number) => void;
  isPlayerTurn: boolean;
  playerHits: HitsEnum[][];
  enemyHits: HitsEnum[][];
  showHomeButton: boolean;
}

const Game = ({
  placedShips,
  onEnemyCellClick,
  isPlayerTurn,
  playerHits,
  enemyHits,
  showHomeButton,
}: GameProps) => {
  // Check if a cell contains a ship
  const getShipAtCell = (row: number, col: number): PlacedShip | undefined => {
    return placedShips.find((ship) =>
      ship.cells.some((cell) => cell.row === row && cell.col === col)
    );
  };

  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {showHomeButton && (
        <div className="flex justify-center text-center">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded border-2 border-slate-600 transition-all"
          >
            <Home size={20} />
            <span>Home</span>
          </button>
        </div>
      )}
      {/* Turn Indicator */}
      <div className="bg-slate-800 p-4 rounded-lg border-2 border-slate-700 shadow-xl text-center">
        {isPlayerTurn ? (
          <p className="text-xl font-bold text-yellow-400">Your Turn</p>
        ) : (
          <p className="text-xl font-bold text-red-400">Enemy Turn</p>
        )}
      </div>

      {/* Boards Container */}
      <div className="flex gap-8 items-start">
        {/* Enemy Board */}
        <div className="bg-slate-800 p-6 rounded-lg border-2 border-slate-700 shadow-xl">
          <h2 className="text-2xl font-bold text-white mb-4 text-center">
            Enemy Waters
          </h2>
          <div className="inline-block bg-slate-900 p-2 rounded">
            {Array.from({ length: GRID_SIZE }).map((_, row) => (
              <div key={row} className="flex">
                {Array.from({ length: GRID_SIZE }).map((_, col) => {
                  const hitCell = enemyHits[row][col]; // Get data for this cell

                  return (
                    <button
                      key={col}
                      onClick={() => onEnemyCellClick?.(row, col)}
                      className={`w-10 h-10 border border-slate-700 transition-colors focus:outline-none
                        ${hitCell === HitsEnum.Hit ? "bg-red-500" : ""}
                        ${hitCell === HitsEnum.Miss ? "bg-blue-500" : ""}
                        ${hitCell === HitsEnum.Ship ? "bg-teal-500" : ""}
                        ${
                          hitCell === HitsEnum.Default
                            ? "bg-slate-800 hover:bg-slate-700"
                            : ""
                        }
                        `}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Player Board */}
        <div className="bg-slate-800 p-6 rounded-lg border-2 border-slate-700 shadow-xl">
          <h2 className="text-2xl font-bold text-white mb-4 text-center">
            Your Waters
          </h2>
          <div className="inline-block bg-slate-900 p-2 rounded">
            {Array.from({ length: GRID_SIZE }).map((_, row) => (
              <div key={row} className="flex">
                {Array.from({ length: GRID_SIZE }).map((_, col) => {
                  const shipAtCell = getShipAtCell(row, col);
                  const hitCell = playerHits[row][col]; // Get data for this cell

                  return (
                    <div
                      key={col}
                      className={`w-10 h-10 border border-slate-700 transition-colors ${
                        shipAtCell &&
                        !(
                          hitCell === HitsEnum.Hit ||
                          hitCell === HitsEnum.Miss ||
                          hitCell === HitsEnum.Ship
                        )
                          ? shipAtCell.color
                          : ""
                      }
                        ${
                          hitCell === HitsEnum.Default && !shipAtCell
                            ? "bg-slate-800"
                            : ""
                        }
                        ${hitCell === HitsEnum.Hit ? "bg-amber-950" : ""}
                        ${hitCell === HitsEnum.Miss ? "bg-white" : ""}
                        ${hitCell === HitsEnum.Ship ? "bg-rose-300" : ""}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Game;
