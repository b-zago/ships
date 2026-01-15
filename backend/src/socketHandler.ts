import type { DefaultEventsMap, Server } from "socket.io";
import { getLobbyTokens, redisClient, validateToken } from "./redis.js";
import type { Hit, PlacedShip } from "./types.js";
import { verifyAttack } from "./util.js";

const lobbyTimers = new Map<string, NodeJS.Timeout>();
const DISCONNECT_TIMEOUT = 60000; // 60 seconds

const connectedUsers = new Map<string, string>();

export function setupSocketHandlers(
  io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>
) {
  // Middleware
  io.use((socket, next) => {
    // Parse cookies
    const cookies = socket.handshake.headers.cookie;
    const parsedCookies = Object.fromEntries(
      cookies?.split("; ").map((c) => c.split("=")) || []
    );

    const token = parsedCookies.token;
    const lobbyId = parsedCookies.lobbyId;

    // Validate token
    if (!token) {
      return next(new Error("Authentication required"));
    }

    // Check if token is valid (check against your lobbies/database)
    const isValid = validateToken(token, lobbyId); // Your validation logic

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

    // If we now have 2 players, cancel any existing timer
    if (socketsInRoom.length === 2 && lobbyTimers.has(lobbyId)) {
      console.log(`Cancelling disconnect timer for lobby ${lobbyId}`);
      clearTimeout(lobbyTimers.get(lobbyId)!);
      lobbyTimers.delete(lobbyId);
      io.to(lobbyId).emit("timer-cancelled");
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
      const isPreparation = await redisClient.hGet(
        `lobby:${lobbyId}`,
        "preparation"
      );

      if (isPreparation === "0") {
        //ships already placed
        return;
      }
      //validate if correct ships here
      // Save ships to Redis if correct
      await redisClient.hSet(
        `lobby:${lobbyId}`,
        `${playerPrefix}Ships`,
        JSON.stringify(ships)
      );

      await redisClient.hSet(`lobby:${lobbyId}`, `${playerPrefix}Ready`, "1");
      // Update lobby status if both players ready
      const isEnemyReady = await redisClient.hGet(
        `lobby:${lobbyId}`,
        `${enemyPrefix}Ready`
      );

      if (isEnemyReady === "1") {
        await redisClient.hSet(`lobby:${lobbyId}`, "preparation", "0");
        await redisClient.hSet(`lobby:${lobbyId}`, "playerTurn", "A");
        io.to(lobbyId).emit("set-turn", "A");
        io.to(lobbyId).emit("start-game");
        console.log("start game!");
      } else {
        io.to(lobbyId).emit("playerReady");
      }
    });

    // Handle attacks
    socket.on("attack", async (cell: Hit) => {
      // Process attack
      // Emit result to both players
      const currentTurn = await redisClient.hGet(
        `lobby:${lobbyId}`,
        "playerTurn"
      );

      console.log("player::", player);
      console.log("turn::", currentTurn);

      if (player === currentTurn) {
        //this all also needs errors handling later lol
        const currentHitsStr = await redisClient.hGet(
          `lobby:${lobbyId}`,
          `${playerPrefix}Hits`
        );

        const currentSunksStr = await redisClient.hGet(
          `lobby:${lobbyId}`,
          `${enemyPrefix}Sunk`
        );

        const attackResult = await verifyAttack(
          lobbyId,
          cell,
          currentHitsStr as string, //HANDLE PROPERLY LATER
          enemyPrefix
        );

        if (!attackResult.valid) {
          console.log(`Invalid attack: ${attackResult.error}`);
          return;
          //emit error event here
        }

        if (attackResult.hit && !attackResult.sunk) {
          console.log(`Hit ${attackResult.shipName}!`);
          //emit hit event here
          io.to(lobbyId).emit("hit", { cell, player });
        } else if (attackResult.sunk) {
          console.log(`${attackResult.shipName} has been sunk!`);
          //emit sunk event here
          const currentSunks: number[] = currentSunksStr
            ? JSON.parse(currentSunksStr)
            : [];

          currentSunks.push(attackResult.shipId!); //fix types here later

          await redisClient.hSet(
            `lobby:${lobbyId}`,
            `${enemyPrefix}Sunk`,
            JSON.stringify(currentSunks)
          );
          io.to(lobbyId).emit("sunk", {
            ship: attackResult.shipName,
            shipCells: attackResult.shipCells,
            player,
          });

          //game end
          if (currentSunks.length === 5) {
            io.to(lobbyId).emit("game-end", player);
            //clean redis ofc
            await redisClient.del(`lobby:${lobbyId}`);
            return;
          }
        } else {
          console.log("Miss!");
          //emit miss event here
          io.to(lobbyId).emit("miss", { cell, player });
        }
        //this is already done in verifyAttack - optimize later
        const currentHits: Hit[] = currentHitsStr
          ? JSON.parse(currentHitsStr)
          : [];

        currentHits.push(cell);

        await redisClient.hSet(
          `lobby:${lobbyId}`,
          `${playerPrefix}Hits`,
          JSON.stringify(currentHits)
        );

        await redisClient.hSet(`lobby:${lobbyId}`, "playerTurn", enemyPlayer);
        io.to(lobbyId).emit("set-turn", enemyPlayer);
      }
    });

    // Handle disconnection
    socket.on("disconnect", async () => {
      console.log(`User disconnected from lobby ${lobbyId}`);

      const currentSocketId = connectedUsers.get(token);

      if (currentSocketId === socket.id) {
        connectedUsers.delete(token);
      }

      const isPreparation = await redisClient.hGet(
        `lobby:${lobbyId}`,
        "preparation"
      );

      if (isPreparation === "1") {
        await redisClient.hSet(`lobby:${lobbyId}`, `${playerPrefix}Ready`, "0");
      }

      // Check how many players remain after this disconnect
      const remainingSockets = await io.in(lobbyId).fetchSockets();

      // Only start timer if less than 2 players AND no timer exists
      if (remainingSockets.length < 2 && !lobbyTimers.has(lobbyId)) {
        console.log(`Starting disconnect timer for lobby ${lobbyId}`);

        const timer = setTimeout(async () => {
          console.log(`Lobby ${lobbyId} expired due to disconnection`);

          await redisClient.del(`lobby:${lobbyId}`);
          lobbyTimers.delete(lobbyId);

          const sockets = await io.in(lobbyId).fetchSockets();
          sockets.forEach((s) => s.disconnect(true));
        }, DISCONNECT_TIMEOUT);

        lobbyTimers.set(lobbyId, timer);

        io.to(lobbyId).emit("disconnect-timer-started", DISCONNECT_TIMEOUT);
      }
    });
  });
}
