import type { Lobby } from "./types.js";
import { createClient } from "redis";

export const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
  },
});

export async function saveLobby(lobby: Lobby): Promise<void> {
  // Static data + state (one hash)
  await redisClient.hSet(`lobby:${lobby.id}`, {
    playerAToken: lobby.playerAToken,
    playerBToken: lobby.playerBToken,
    playerAShips: JSON.stringify(lobby.playerAShips),
    playerBShips: JSON.stringify(lobby.playerBShips),
    playerAHits: JSON.stringify(lobby.playerAHits),
    playerBHits: JSON.stringify(lobby.playerBHits),
  });

  // Expiration
  await redisClient.expire(`lobby:${lobby.id}`, 3600);
}

export async function getLobby(lobbyId: string): Promise<Lobby | null> {
  const data = await redisClient.hGetAll(`lobby:${lobbyId}`);

  if (!data || Object.keys(data).length === 0) {
    return null;
  }

  return {
    id: lobbyId,
    playerAToken: data.playerAToken,
    playerBToken: data.playerBToken,
    playerAShips: JSON.parse(data.playerAShips || "[]"),
    playerBShips: JSON.parse(data.playerBShips || "[]"),
    playerAHits: JSON.parse(data.playerAHits || "[]"),
    playerBHits: JSON.parse(data.playerBHits || "[]"),
    status: data.status as any,
  };
}

export async function getLobbyTokens(
  lobbyId: string
): Promise<{ playerAToken: string | null; playerBToken: string | null }> {
  const playerAToken = await redisClient.hGet(
    `lobby:${lobbyId}`,
    "playerAToken"
  );

  const playerBToken = await redisClient.hGet(
    `lobby:${lobbyId}`,
    "playerBToken"
  );

  return {
    playerAToken,
    playerBToken,
  };
}

export async function setPlayerBToken(lobbyId: string, token: string) {
  redisClient.hSet(`lobby:${lobbyId}`, "playerBToken", token);
}

export async function validateToken(lobbyId: string, token: string) {
  const tokens = await getLobbyTokens(lobbyId);

  if (tokens.playerAToken === token || tokens.playerBToken === token) {
    return true;
  }
  return false;
}
