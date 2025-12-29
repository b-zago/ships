import React from "react";

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
}

const Game = ({ placedShips, onEnemyCellClick }: GameProps) => {
  // Check if a cell contains a ship
  const getShipAtCell = (row: number, col: number): PlacedShip | undefined => {
    return placedShips.find((ship) =>
      ship.cells.some((cell) => cell.row === row && cell.col === col)
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-b from-slate-900 to-slate-800 relative overflow-hidden">
      <div className="space-y-6">
        {/* Turn Indicator */}
        <div className="bg-slate-800 p-4 rounded-lg border-2 border-slate-700 shadow-xl text-center">
          <p className="text-xl font-bold text-yellow-400">Your Turn</p>
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
                  {Array.from({ length: GRID_SIZE }).map((_, col) => (
                    <button
                      key={col}
                      onClick={() => onEnemyCellClick?.(row, col)}
                      className="w-10 h-10 border border-slate-700 bg-slate-800 hover:bg-slate-700 transition-colors focus:outline-none"
                    />
                  ))}
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

                    return (
                      <div
                        key={col}
                        className={`w-10 h-10 border border-slate-700 transition-colors ${
                          shipAtCell ? shipAtCell.color : "bg-slate-800"
                        }`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Game;
