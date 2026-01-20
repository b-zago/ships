import type { DefaultEventsMap, Server } from "socket.io";
import { getLobbyTokens, redisClient, validateToken } from "./redis.js";
import type { Hit, PlacedShip } from "./types.js";
import { verifyAttack } from "./util.js";
import { safeRedisOperation, strictRedisOperation } from "./redis-utils.js";

const lobbyTimers = new Map<string, NodeJS.Timeout>();
const DISCONNECT_TIMEOUT = 60000; // 60 seconds

const connectedUsers = new Map<string, string>();

// Helper function to clear lobby timer
function clearLobbyTimer(lobbyId: string) {
  if (lobbyTimers.has(lobbyId)) {
    clearTimeout(lobbyTimers.get(lobbyId)!);
    lobbyTimers.delete(lobbyId);
  }
}

export function setupSocketHandlers(
  io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
) {
  io.use(async (socket, next) => {
    // Parse cookies
    const cookies = socket.handshake.headers.cookie;
    const parsedCookies = Object.fromEntries(
      cookies?.split("; ").map((c) => c.split("=")) || [],
    );

    const token = parsedCookies.token;
    const lobbyId = parsedCookies.lobbyId;

    // Validate token
    if (!token) {
      return next(new Error("Authentication required"));
    }

    // Check if token is valid (check against your lobbies/database)
    const isValid = await validateToken(lobbyId, token); // Added await

    if (!isValid) {
      return next(new Error("Invalid token"));
    }

    //this is to ensure one socket connection per one user
    if (connectedUsers.has(token)) {
      const existingSocketId = connectedUsers.get(token);
      const existingSocket = io.sockets.sockets.get(existingSocketId!);

      if (existingSocket && existingSocket.connected) {
        console.log(`Disconnecting duplicate connection for token: ${token}`);
        console.log("DISCONNECT THE BITCH");
        existingSocket.disconnect(true); // Disconnect the old connection
      }
    }

    connectedUsers.set(token, socket.id);

    // Attach user data to socket for later use
    socket.data.token = token;
    socket.data.lobbyId = lobbyId;

    next(); // Allow connection
  });

  // Handle socket connections
  io.on("connection", async (socket) => {
    const { token, lobbyId } = socket.data;

    console.log(`User connected to lobby ${lobbyId}`);

    // Join the lobby room
    socket.join(lobbyId);

    // Check how many players are in the lobby now
    const socketsInRoom = await io.in(lobbyId).fetchSockets();

    console.log("------------------------------------");
    console.log("SOCKETS IN LOBBY:", socketsInRoom);

    // If we now have 2 players, cancel any existing timer and refresh lobby TTL
    if (socketsInRoom.length === 2) {
      if (lobbyTimers.has(lobbyId)) {
        console.log(`Cancelling disconnect timer for lobby ${lobbyId}`);
        clearLobbyTimer(lobbyId);
        io.to(lobbyId).emit("timer-cancelled");
      }

      // Refresh the lobby TTL when both players are connected
      await safeRedisOperation(
        async () => await redisClient.expire(`lobby:${lobbyId}`, 3600),
        "Failed to refresh lobby TTL",
      );
    }

    // Determine if this is playerA or playerB
    const lobbyTokens = await getLobbyTokens(lobbyId);
    const isPlayerA = token === lobbyTokens.playerAToken;

    const playerPrefix = isPlayerA ? "playerA" : "playerB";
    const enemyPrefix = isPlayerA ? "playerB" : "playerA";
    const player = isPlayerA ? "A" : "B";
    const enemyPlayer = isPlayerA ? "B" : "A";

    socket.emit("set-player", player);

    // Notify other players in the lobby
    socket.to(lobbyId).emit("player-joined", player);
    console.log("PLAYER JOINED BITCH!");

    // Handle ship placement
    socket.on("place-ships", async (ships: PlacedShip[]) => {
      const isPreparation = await safeRedisOperation(
        async () => await redisClient.hGet(`lobby:${lobbyId}`, "preparation"),
        "Failed to get preparation status",
      );

      if (isPreparation === "0") {
        //ships already placed
        socket.emit("error", "Ships already placed");
        return;
      }
      //validate if correct ships here
      // Save ships to Redis if correct
      try {
        await strictRedisOperation(async () => {
          await redisClient.hSet(
            `lobby:${lobbyId}`,
            `${playerPrefix}Ships`,
            JSON.stringify(ships),
          );

          await redisClient.hSet(
            `lobby:${lobbyId}`,
            `${playerPrefix}Ready`,
            "1",
          );
        }, "Failed to save ship placement");
      } catch (error) {
        socket.emit("error", "Failed to save ship placement");
        return;
      }

      // Update lobby status if both players ready
      const isEnemyReady = await safeRedisOperation(
        async () =>
          await redisClient.hGet(`lobby:${lobbyId}`, `${enemyPrefix}Ready`),
        "Failed to get enemy ready status",
      );

      if (isEnemyReady === "1") {
        try {
          await strictRedisOperation(async () => {
            await redisClient.hSet(`lobby:${lobbyId}`, "preparation", "0");
            await redisClient.hSet(`lobby:${lobbyId}`, "playerTurn", "A");
          }, "Failed to start game");
          io.to(lobbyId).emit("set-turn", "A");
          io.to(lobbyId).emit("start-game");
          console.log("start game!");
        } catch (error) {
          socket.emit("error", "Failed to start game");
        }
      } else {
        io.to(lobbyId).emit("playerReady");
      }
    });

    // Handle attacks
    socket.on("attack", async (cell: Hit) => {
      // Process attack
      // Emit result to both players
      const currentTurn = await safeRedisOperation(
        async () => await redisClient.hGet(`lobby:${lobbyId}`, "playerTurn"),
        "Failed to get current turn",
      );

      console.log("player::", player);
      console.log("turn::", currentTurn);

      if (player !== currentTurn) {
        socket.emit("error", "Not your turn");
        return;
      }

      const currentHitsStr = await safeRedisOperation(
        async () =>
          await redisClient.hGet(`lobby:${lobbyId}`, `${playerPrefix}Hits`),
        "Failed to get current hits",
      );

      if (currentHitsStr === null) {
        socket.emit("error", "Failed to get current hits");
        return;
      }

      const currentSunksStr = await safeRedisOperation(
        async () =>
          await redisClient.hGet(`lobby:${lobbyId}`, `${enemyPrefix}Sunk`),
        "Failed to get current sunks",
      );

      if (currentSunksStr === null) {
        socket.emit("error", "Failed to get current sunks");
        return;
      }

      const attackResult = await verifyAttack(
        lobbyId,
        cell,
        currentHitsStr,
        enemyPrefix,
      );

      if (!attackResult.valid) {
        console.log(`Invalid attack: ${attackResult.error}`);
        socket.emit("error", attackResult.error || "Invalid attack");
        return;
      }

      // Save the hit first (common for all attack outcomes)
      const currentHits: Hit[] = currentHitsStr
        ? JSON.parse(currentHitsStr)
        : [];
      currentHits.push(cell);

      try {
        await strictRedisOperation(async () => {
          await redisClient.hSet(
            `lobby:${lobbyId}`,
            `${playerPrefix}Hits`,
            JSON.stringify(currentHits),
          );
        }, "Failed to save hit");
      } catch (error) {
        socket.emit("error", "Failed to save hit");
        return;
      }

      if (attackResult.hit && !attackResult.sunk) {
        console.log(`Hit ${attackResult.shipName}!`);
        io.to(lobbyId).emit("hit", { cell, player });
      } else if (attackResult.sunk) {
        console.log(`${attackResult.shipName} has been sunk!`);

        const currentSunks: number[] = currentSunksStr
          ? JSON.parse(currentSunksStr)
          : [];

        currentSunks.push(attackResult.shipId!);

        try {
          await strictRedisOperation(async () => {
            await redisClient.hSet(
              `lobby:${lobbyId}`,
              `${enemyPrefix}Sunk`,
              JSON.stringify(currentSunks),
            );
          }, "Failed to update sunk ships");
        } catch (error) {
          socket.emit("error", "Failed to update sunk ships");
          return;
        }

        io.to(lobbyId).emit("sunk", {
          ship: attackResult.shipName,
          shipCells: attackResult.shipCells,
          player,
        });

        //game end
        if (currentSunks.length === 5) {
          const playerAShips = await safeRedisOperation(
            async () =>
              await redisClient.hGet(`lobby:${lobbyId}`, "playerAShips"),
            "Failed to get player A ships",
          );

          const playerBShips = await safeRedisOperation(
            async () =>
              await redisClient.hGet(`lobby:${lobbyId}`, "playerBShips"),
            "Failed to get player B ships",
          );

          if (playerAShips && playerBShips) {
            io.to(lobbyId).emit("game-end", {
              playerAShips: JSON.parse(playerAShips),
              playerBShips: JSON.parse(playerBShips),
              player,
            });
          }

          // Clear any existing timer for this lobby
          clearLobbyTimer(lobbyId);

          // Clean up Redis
          await safeRedisOperation(
            async () => await redisClient.del(`lobby:${lobbyId}`),
            "Failed to delete lobby",
          );
          return;
        }
      } else {
        console.log("Miss!");
        io.to(lobbyId).emit("miss", { cell, player });

        try {
          await strictRedisOperation(async () => {
            await redisClient.hSet(
              `lobby:${lobbyId}`,
              "playerTurn",
              enemyPlayer,
            );
          }, "Failed to update turn");
          io.to(lobbyId).emit("set-turn", enemyPlayer);
        } catch (error) {
          socket.emit("error", "Failed to update turn");
        }
      }
    });

    // Handle disconnection
    socket.on("disconnect", async () => {
      console.log(`User disconnected from lobby ${lobbyId}`);

      const currentSocketId = connectedUsers.get(token);

      if (currentSocketId === socket.id) {
        connectedUsers.delete(token);
      }

      const isPreparation = await safeRedisOperation(
        async () => await redisClient.hGet(`lobby:${lobbyId}`, "preparation"),
        "Failed to get preparation status",
      );

      if (isPreparation === "1") {
        await safeRedisOperation(async () => {
          await redisClient.hSet(
            `lobby:${lobbyId}`,
            `${playerPrefix}Ready`,
            "0",
          );
        }, "Failed to reset player ready status");
      }

      // Check how many players remain after this disconnect
      const remainingSockets = await io.in(lobbyId).fetchSockets();

      // Only start timer if less than 2 players AND no timer exists
      if (remainingSockets.length < 2 && !lobbyTimers.has(lobbyId)) {
        console.log(`Starting disconnect timer for lobby ${lobbyId}`);

        const timer = setTimeout(async () => {
          console.log(`Lobby ${lobbyId} expired due to disconnection`);

          await safeRedisOperation(
            async () => await redisClient.del(`lobby:${lobbyId}`),
            "Failed to delete lobby on timeout",
          );
          clearLobbyTimer(lobbyId);

          const sockets = await io.in(lobbyId).fetchSockets();
          sockets.forEach((s) => s.disconnect(true));
        }, DISCONNECT_TIMEOUT);

        lobbyTimers.set(lobbyId, timer);

        io.to(lobbyId).emit("disconnect-timer-started", DISCONNECT_TIMEOUT);
      }
    });
  });
}
