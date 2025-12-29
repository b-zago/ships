import { useState, useEffect, type SetStateAction } from "react";

const GRID_SIZE = 10;
const CELL_SIZE = 40;

interface Ship {
  id: number;
  name: string;
  length: number;
  color: string;
}

interface PlacedShip extends Ship {
  cells: Cell[];
  isHorizontal: boolean;
}

interface Cell {
  row: number;
  col: number;
}

interface LobbyProps {
  placedShips: PlacedShip[];
  setPlacedShips: React.Dispatch<SetStateAction<PlacedShip[]>>;
  confirmShips: () => void;
}

const SHIPS: Ship[] = [
  { id: 1, name: "Carrier", length: 5, color: "bg-blue-500" },
  { id: 2, name: "Battleship", length: 4, color: "bg-green-500" },
  { id: 3, name: "Cruiser", length: 3, color: "bg-yellow-500" },
  { id: 4, name: "Submarine", length: 3, color: "bg-purple-500" },
  { id: 5, name: "Destroyer", length: 2, color: "bg-red-500" },
];

function Lobby({ placedShips, setPlacedShips, confirmShips }: LobbyProps) {
  const [selectedShip, setSelectedShip] = useState<number | null>(null);
  const [isHorizontal, setIsHorizontal] = useState<boolean>(true);

  const [hoveredCell, setHoveredCell] = useState<Cell | null>(null);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "r" && selectedShip) {
        setIsHorizontal(!isHorizontal);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [selectedShip, isHorizontal]);

  const canPlaceShip = (
    row: number,
    col: number,
    length: number,
    horizontal: boolean,
    excludeShipId?: number
  ): boolean => {
    if (horizontal) {
      if (col + length > GRID_SIZE) return false;
      for (let i = 0; i < length; i++) {
        if (
          placedShips.some(
            (ship) =>
              ship.id !== excludeShipId &&
              ship.cells.some(
                (cell) => cell.row === row && cell.col === col + i
              )
          )
        ) {
          return false;
        }
      }
    } else {
      if (row + length > GRID_SIZE) return false;
      for (let i = 0; i < length; i++) {
        if (
          placedShips.some(
            (ship) =>
              ship.id !== excludeShipId &&
              ship.cells.some(
                (cell) => cell.row === row + i && cell.col === col
              )
          )
        ) {
          return false;
        }
      }
    }
    return true;
  };

  const handleCellClick = (row: number, col: number) => {
    if (!selectedShip) {
      // Check if clicking on a placed ship to reselect it
      const clickedShip = placedShips.find((s) =>
        s.cells.some((cell) => cell.row === row && cell.col === col)
      );
      if (clickedShip) {
        setSelectedShip(clickedShip.id);
        setIsHorizontal(clickedShip.isHorizontal);
        setPlacedShips(placedShips.filter((s) => s.id !== clickedShip.id));
      }
      return;
    }

    const ship = SHIPS.find((s) => s.id === selectedShip);
    if (!ship) return;

    if (!canPlaceShip(row, col, ship.length, isHorizontal, selectedShip))
      return;

    const cells: Cell[] = [];
    for (let i = 0; i < ship.length; i++) {
      cells.push({
        row: isHorizontal ? row : row + i,
        col: isHorizontal ? col + i : col,
      });
    }

    // Remove old placement if exists
    const newPlacedShips = placedShips.filter((s) => s.id !== selectedShip);
    setPlacedShips([...newPlacedShips, { ...ship, cells, isHorizontal }]);
    setSelectedShip(null);
  };

  const handleShipSelect = (shipId: number) => {
    const placedShip = placedShips.find((s) => s.id === shipId);
    if (placedShip) {
      // Remove from board and select for replacement
      setPlacedShips(placedShips.filter((s) => s.id !== shipId));
      setSelectedShip(shipId);
      setIsHorizontal(placedShip.isHorizontal);
    } else {
      setSelectedShip(shipId);
    }
  };

  const isShipPlaced = (shipId: number): boolean => {
    return placedShips.some((s) => s.id === shipId);
  };

  const getCellContent = (row: number, col: number): PlacedShip | undefined => {
    return placedShips.find((s) =>
      s.cells.some((cell) => cell.row === row && cell.col === col)
    );
  };

  const getPreviewCells = (row: number, col: number): Cell[] => {
    if (!selectedShip) return [];

    const ship = SHIPS.find((s) => s.id === selectedShip);
    if (!ship) return [];

    const cells: Cell[] = [];
    for (let i = 0; i < ship.length; i++) {
      cells.push({
        row: isHorizontal ? row : row + i,
        col: isHorizontal ? col + i : col,
      });
    }
    return cells;
  };

  const isPreviewCell = (row: number, col: number): boolean => {
    if (!hoveredCell || !selectedShip) return false;
    const previewCells = getPreviewCells(hoveredCell.row, hoveredCell.col);
    return previewCells.some((c) => c.row === row && c.col === col);
  };

  const isValidPreview = (row: number, col: number): boolean => {
    if (!selectedShip || !hoveredCell) return false;
    const ship = SHIPS.find((s) => s.id === selectedShip);
    if (!ship) return false;
    return canPlaceShip(
      hoveredCell.row,
      hoveredCell.col,
      ship.length,
      isHorizontal,
      selectedShip
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-b from-slate-900 to-slate-800 relative overflow-hidden">
      <div className="flex gap-8 items-start">
        {/* Left - Ships Selection */}
        <div className="bg-slate-800 p-6 rounded-lg border-2 border-slate-700 shadow-xl">
          <h2 className="text-2xl font-bold text-white mb-4">Your Fleet</h2>
          <div className="space-y-4">
            {SHIPS.map((ship) => (
              <div key={ship.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-white text-sm">{ship.name}</p>
                  {isShipPlaced(ship.id) && (
                    <span className="text-green-400 text-lg">✓</span>
                  )}
                </div>
                <button
                  onClick={() => handleShipSelect(ship.id)}
                  className={`relative ${
                    selectedShip === ship.id
                      ? "ring-4 ring-yellow-400"
                      : "hover:ring-2 ring-slate-500"
                  } transition-all`}
                >
                  <div className="flex gap-0.5">
                    {Array.from({ length: ship.length }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-10 h-10 ${ship.color} border border-slate-900`}
                      />
                    ))}
                  </div>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Center - Game Board */}
        <div className="bg-slate-800 p-6 rounded-lg border-2 border-slate-700 shadow-xl">
          <h2 className="text-2xl font-bold text-white mb-4 text-center">
            Your Board
          </h2>
          <div className="inline-block bg-slate-900 p-2 rounded">
            {Array.from({ length: GRID_SIZE }).map((_, row) => (
              <div key={row} className="flex">
                {Array.from({ length: GRID_SIZE }).map((_, col) => {
                  const shipHere = getCellContent(row, col);
                  const isPreview = isPreviewCell(row, col);
                  const validPreview = isValidPreview(row, col);

                  let cellClass =
                    "w-10 h-10 border border-slate-700 transition-colors focus:outline-none ";

                  if (shipHere) {
                    cellClass += `${shipHere.color} ${
                      selectedShip ? "cursor-pointer hover:opacity-80" : ""
                    }`;
                  } else if (isPreview && selectedShip) {
                    const ship = SHIPS.find((s) => s.id === selectedShip);
                    if (validPreview) {
                      cellClass += `${ship?.color} opacity-60 border-2 border-green-400`;
                    } else {
                      cellClass +=
                        "bg-red-600 opacity-60 border-2 border-red-400";
                    }
                  } else {
                    cellClass += "bg-slate-800 hover:bg-slate-700";
                  }

                  return (
                    <button
                      key={col}
                      onClick={() => handleCellClick(row, col)}
                      onMouseEnter={() => setHoveredCell({ row, col })}
                      onMouseLeave={() => setHoveredCell(null)}
                      className={cellClass}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Right - Instructions */}
        <div className="bg-slate-800 p-6 rounded-lg border-2 border-slate-700 shadow-xl max-w-xs">
          <h2 className="text-2xl font-bold text-white mb-4">Instructions</h2>
          <div className="space-y-4 text-slate-300">
            <div className="bg-slate-900 p-4 rounded">
              <p className="text-sm leading-relaxed">
                <span className="text-yellow-400 font-semibold">1.</span> Click
                on a ship from your fleet on the left
              </p>
            </div>
            <div className="bg-slate-900 p-4 rounded">
              <p className="text-sm leading-relaxed">
                <span className="text-yellow-400 font-semibold">2.</span> Click
                on your board to place the ship
              </p>
            </div>
            <div className="bg-slate-900 p-4 rounded">
              <p className="text-sm leading-relaxed">
                <span className="text-yellow-400 font-semibold">3.</span> Press{" "}
                <kbd className="px-2 py-1 bg-slate-700 rounded text-xs">R</kbd>{" "}
                to rotate the selected ship
              </p>
            </div>
            <div className="bg-slate-900 p-4 rounded">
              <p className="text-sm leading-relaxed">
                <span className="text-yellow-400 font-semibold">4.</span> Click
                on a placed ship to move it elsewhere
              </p>
            </div>
            <div className="mt-6 p-4 bg-blue-900 bg-opacity-30 rounded border border-blue-500">
              <p className="text-sm text-blue-200">
                {selectedShip
                  ? `${
                      SHIPS.find((s) => s.id === selectedShip)?.name
                    } selected (${isHorizontal ? "Horizontal" : "Vertical"})`
                  : "No ship selected"}
              </p>
            </div>
            {placedShips.length === SHIPS.length && (
              <button
                className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded transition-colors"
                onClick={confirmShips}
              >
                Ready to Battle!
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Lobby;
