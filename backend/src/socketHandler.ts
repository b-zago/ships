import type { DefaultEventsMap, Server } from "socket.io";
import { getLobbyTokens, redisClient, validateToken } from "./redis.js";
import type { Hit, PlacedShip } from "./types.js";
import { verifyAttack } from "./util.js";

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

    // Determine if this is playerA or playerB
    const lobbyTokens = await getLobbyTokens(lobbyId);
    const isPlayerA = token === lobbyTokens.playerAToken;

    const playerPrefix = isPlayerA ? "playerA" : "playerB";
    const enemyPrefix = isPlayerA ? "playerB" : "playerA";
    const player = isPlayerA ? "A" : "B";
    const enemyPlayer = isPlayerA ? "B" : "A";

    socket.emit("set-player", player);

    // Notify other players in the lobby
    socket.to(lobbyId).emit("player-joined", {
      player: player,
    });

    // Handle ship placement
    socket.on("place-ships", async (ships: PlacedShip[]) => {
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

        if (attackResult.hit) {
          console.log(`Hit ${attackResult.shipName}!`);
          //emit hit event here
          io.to(lobbyId).emit("hit", { cell, player });
          if (attackResult.sunk) {
            console.log(`${attackResult.shipName} has been sunk!`);
            //emit sunk event here
            io.to(lobbyId).emit("sunk", { ship: attackResult.shipName });
            //add some logic of counting sunken ships somehow (maybe just in redis?)
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
    socket.on("disconnect", () => {
      console.log(`User disconnected from lobby ${lobbyId}`);
      socket.to(lobbyId).emit("player-disconnected", {
        player: socket.data.player,
      });
    });
  });
}
