import { Home } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import io from "socket.io-client";
import axios from "axios";

import Game from "../components/Game";
import Lobby from "../components/Lobby";
import { ToastContainer } from "../components/Toast";

export const HitsEnum = {
  Default: 0,
  Hit: 1,
  Miss: 2,
  Ship: 3,
} as const;

export type HitsEnum = (typeof HitsEnum)[keyof typeof HitsEnum];

const defaultHits = Array.from({ length: 10 }, () =>
  Array.from<HitsEnum>({ length: 10 }).fill(HitsEnum.Default)
);

interface JoinLobbyResponseBase {
  status: string;
  message?: string;
}

interface JoinLobbyResponseWithPlayer extends JoinLobbyResponseBase {
  player: "A" | "B";
  isPrepared: boolean;
  playerShips: PlacedShip[];
  playerHits: HitsEnum[][];
  enemyHits: HitsEnum[][];
  playerTurn: "A" | "B";
}

interface JoinLobbyResponseWithoutPlayer extends JoinLobbyResponseBase {
  player?: never;
  isPrepared?: never;
  playerShips?: never;
  playerHits?: never;
  enemyHits?: never;
  playerTurn?: never;
}

type JoinLobbyResponse =
  | JoinLobbyResponseWithPlayer
  | JoinLobbyResponseWithoutPlayer;

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

type HitData = {
  cell: Cell;
  player: "A" | "B";
};

type SunkData = {
  shipCells: Cell[];
  ship: string;
  player: "A" | "B";
};

function GameController() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isPlayerTurn, setIsPlayerTurn] = useState<boolean>(false);
  const [enemyHits, setEnemyHits] = useState<HitsEnum[][]>(defaultHits);
  const [playerHits, setPlayerHits] = useState<HitsEnum[][]>(defaultHits);
  const [placedShips, setPlacedShips] = useState<PlacedShip[]>([]);
  const [gameEndPopup, setGameEndPopup] = useState<null | "A" | "B">(null);
  const [showHomeButton, setShowHomeButton] = useState(false);

  const [toasts, setToasts] = useState<
    Array<{ id: string; message: string; time: number }>
  >([]);

  const playerRef = useRef("");
  const toastIdCounter = useRef(0);
  const socketRef = useRef<SocketIOClient.Socket | null>(null);

  useEffect(() => {
    axios
      .get<JoinLobbyResponse>(`http://localhost:3000/api/lobby/join/${id}`, {
        withCredentials: true,
      })
      .then((response) => {
        console.log("Success:", response.data);

        const res = response.data;

        // Check if the status is "ok!" before proceeding
        if (res.status !== "ok!") {
          setConnectionError(response.data.message || "Failed to join lobby");
          setIsConnecting(false);

          return;
        }

        console.log(res.player);
        //if player is in response that means it is a reconnect attempt
        if (res.player) {
          if (res.player === res.playerTurn) {
            setIsPlayerTurn(true);
          }
          setPlacedShips(res.playerShips);
          setPlayerHits(res.playerHits);
          setEnemyHits(res.enemyHits);

          playerRef.current = res.player;

          setGameStarted(true);
        }

        // Only initialize socket if join was successful
        const newSocket = io("http://localhost:3000", {
          transports: ["websocket", "polling"],
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          timeout: 10000,
        });

        socketRef.current = newSocket;

        newSocket.on("connect", () => {
          setConnected(true);
          setIsConnecting(false);
          setConnectionError(null);
        });

        //-----IO CONNECTION ERROR HANDLING------
        newSocket.on("connect_error", (error: Error) => {
          setConnectionError(`Connection failed: ${error.message}`);
          setIsConnecting(false);
          setConnected(false);
        });

        newSocket.on("disconnect", (reason: string) => {
          setConnected(false);
          if (reason === "io server disconnect") {
            setConnectionError("Server disconnected the connection");
          } else if (reason === "io client disconnect") {
            // Manual disconnect, don't show error
          } else {
            setConnectionError("Connection lost. Attempting to reconnect...");
          }
        });

        newSocket.on("reconnect_attempt", (attemptNumber: number) => {
          setConnectionError(`Reconnection attempt ${attemptNumber}...`);
        });

        newSocket.on("reconnect_failed", () => {
          setConnectionError("Failed to reconnect after multiple attempts");
          setIsConnecting(false);
        });

        newSocket.on("reconnect", (attemptNumber: number) => {
          setConnectionError(null);
          setConnected(true);
          console.log(`Reconnected after ${attemptNumber} attempts`);
        });
        //-----------IO DISCONNECTS-----------

        newSocket.on("disconnect-timer-started", (time: number) => {
          addToast(
            `Player has disconnected. The lobby will abort in: ${time} seconds`
          );
        });

        //---------------------------------

        newSocket.on("player-joined", (player: "A" | "B") => {
          console.log("player joined");
          if (player !== playerRef.current) {
            addToast("Another player joined the game!");
          }
        });

        newSocket.on("set-player", (player: "A" | "B") => {
          playerRef.current = player;
        });

        newSocket.on("start-game", () => {
          setGameStarted(true);
        });

        newSocket.on("set-turn", (turn: "A" | "B") => {
          setIsPlayerTurn(turn === playerRef.current);
        });

        newSocket.on("hit", (hit: HitData) => {
          if (hit.player === playerRef.current) {
            setEnemyHits((prev) => {
              const newHits = prev.map((row) => [...row]);
              newHits[hit.cell.row][hit.cell.col] = HitsEnum.Hit;
              return newHits;
            });
          } else {
            setPlayerHits((prev) => {
              const newHits = prev.map((row) => [...row]);
              newHits[hit.cell.row][hit.cell.col] = HitsEnum.Hit;
              return newHits;
            });
          }
        });

        newSocket.on("miss", (hit: HitData) => {
          if (hit.player === playerRef.current) {
            setEnemyHits((prev) => {
              const newHits = prev.map((row) => [...row]);
              newHits[hit.cell.row][hit.cell.col] = HitsEnum.Miss;
              return newHits;
            });
          } else {
            setPlayerHits((prev) => {
              const newHits = prev.map((row) => [...row]);
              newHits[hit.cell.row][hit.cell.col] = HitsEnum.Miss;
              return newHits;
            });
          }
        });

        newSocket.on("sunk", (sunk: SunkData) => {
          addToast(`${sunk.ship} has been sunk!`);
          if (sunk.player === playerRef.current) {
            setEnemyHits((prev) => {
              const newHits = prev.map((row) => [...row]);
              sunk.shipCells.forEach((cell: Cell) => {
                newHits[cell.row][cell.col] = HitsEnum.Ship;
              });
              return newHits;
            });
          } else {
            setPlayerHits((prev) => {
              const newHits = prev.map((row) => [...row]);
              sunk.shipCells.forEach((cell: Cell) => {
                newHits[cell.row][cell.col] = HitsEnum.Ship;
              });
              return newHits;
            });
          }
        });

        newSocket.on("game-end", (player: "A" | "B") => {
          addToast("The game has ended! GG");
          setGameEndPopup(player);
        });
      })
      .catch((error) => {
        console.error("Error:", error);
        setConnectionError("Failed to join lobby");
        setIsConnecting(false);
      });

    return () => {
      // Clean up using socketRef, not socket state
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  const confirmShips = () => {
    socketRef.current?.emit("place-ships", placedShips);
  };

  const onEnemyCellClick = (row: number, col: number) => {
    socketRef.current?.emit("attack", { row, col });
  };

  const addToast = (message: string, time: number = 3000) => {
    const id = `${toastIdCounter.current++}`;
    setToasts((prev) => [...prev, { id, message, time }]);
  };

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => {
      const filtered = prev.filter((toast) => toast.id !== id);

      return filtered;
    });
  }, []);

  // Show error state
  if (connectionError && !connected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md">
          <div className="text-red-500 text-xl font-bold mb-4">
            Connection Error
          </div>
          <p className="text-gray-700 mb-4">{connectionError}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // Show loading state
  if (isConnecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-700">Connecting to server...</p>
        </div>
      </div>
    );
  }

  // Only render game components when connected
  if (!connected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-700">Waiting for connection...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-b from-slate-900 to-slate-800 relative overflow-hidden">
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
      {gameEndPopup && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-slate-800 p-8 rounded-lg border-2 border-slate-700 shadow-xl text-center space-y-6">
            <p className="text-3xl font-bold text-white">
              {gameEndPopup === playerRef.current ? "You Win!" : "You Lost!"}
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => {
                  setShowHomeButton(true);
                  setGameEndPopup(null);
                }}
                className="px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded border-2 border-slate-600 transition-colors"
              >
                OK
              </button>
              <button
                onClick={() => navigate("/")}
                className="flex items-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded border-2 border-slate-600 transition-all"
              >
                <Home size={20} />
                <span>Home</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {gameStarted ? (
        <Game
          placedShips={placedShips}
          onEnemyCellClick={onEnemyCellClick}
          isPlayerTurn={isPlayerTurn}
          playerHits={playerHits}
          enemyHits={enemyHits}
          showHomeButton={showHomeButton}
        />
      ) : (
        <Lobby
          placedShips={placedShips}
          setPlacedShips={setPlacedShips}
          confirmShips={confirmShips}
        />
      )}
    </div>
  );
}

export default GameController;
