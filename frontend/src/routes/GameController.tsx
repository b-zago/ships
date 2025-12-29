import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import io from "socket.io-client";
import axios from "axios";

import Game from "../components/Game";
import Lobby from "../components/Lobby";

interface JoinLobbyResponse {
  status: string;
  message?: string;
}

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

function GameController() {
  const { id } = useParams();

  const [socket, setSocket] = useState<SocketIOClient.Socket | null>(null);
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);

  const [placedShips, setPlacedShips] = useState<PlacedShip[]>([]);

  useEffect(() => {
    axios
      .get<JoinLobbyResponse>(`http://localhost:3000/api/lobby/join/${id}`, {
        withCredentials: true,
      })
      .then((response) => {
        console.log("Success:", response.data);

        // Check if the status is "ok!" before proceeding
        if (response.data.status !== "ok!") {
          setConnectionError(response.data.message || "Failed to join lobby");
          setIsConnecting(false);
          return;
        }

        // Only initialize socket if join was successful
        const newSocket = io("http://localhost:3000", {
          transports: ["websocket", "polling"],
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          timeout: 10000,
        });

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
        //--------------------------------------

        newSocket.on("start-game", () => {
          console.log("start game!");
          setGameStarted(true);
        });

        setSocket(newSocket);
      })
      .catch((error) => {
        console.error("Error:", error);
        setConnectionError("Failed to join lobby");
        setIsConnecting(false);
      });

    return () => {
      // Only disconnect if socket was created
      if (socket) {
        socket.close();
      }
    };
  }, []);

  const confirmShips = () => {
    socket?.emit("place-ships", placedShips);
  };

  const onEnemyCellClick = (row: number, col: number) => {};

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

  if (gameStarted) {
    return (
      <Game placedShips={placedShips} onEnemyCellClick={onEnemyCellClick} />
    );
  }
  return (
    <Lobby
      placedShips={placedShips}
      setPlacedShips={setPlacedShips}
      confirmShips={confirmShips}
    />
  );
}

export default GameController;
