import type { DefaultEventsMap, Server } from "socket.io";
import { getLobbyTokens, validateToken } from "./redis.js";

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

    socket.data.player = isPlayerA ? "A" : "B";

    // Notify other players in the lobby
    socket.to(lobbyId).emit("player-joined", {
      player: socket.data.player,
    });

    // Handle ship placement
    socket.on("place-ships", async (ships) => {
      // Save ships to Redis
      // Update lobby status if both players ready
    });

    // Handle attacks
    socket.on("attack", async (coordinates) => {
      // Process attack
      // Emit result to both players
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
