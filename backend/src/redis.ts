import { createClient } from "redis";
import type { Lobby } from "./types.js";

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
    playerASunk: JSON.stringify(lobby.playerASunk),
    playerBSunk: JSON.stringify(lobby.playerBSunk),
    playerTurn: lobby.playerTurn,
    playerAReady: lobby.playerAReady,
    playerBReady: lobby.playerBReady,
    preparation: lobby.preparation,
  });

  // Expiration
  await redisClient.expire(`lobby:${lobby.id}`, 3600);
}

export async function getLobbyInfo(lobbyId: string) {
  const playerAShips = await redisClient.hGet(
    `lobby:${lobbyId}`,
    "playerAShips"
  );
  const playerBShips = await redisClient.hGet(
    `lobby:${lobbyId}`,
    "playerBShips"
  );
  const playerAHits = await redisClient.hGet(`lobby:${lobbyId}`, "playerAHits");
  const playerBHits = await redisClient.hGet(`lobby:${lobbyId}`, "playerBHits");
  const playerTurn = await redisClient.hGet(`lobby:${lobbyId}`, "playerTurn");
  const playerASunk = await redisClient.hGet(`lobby:${lobbyId}`, "playerASunk");
  const playerBSunk = await redisClient.hGet(`lobby:${lobbyId}`, "playerBSunk");

  return {
    playerAShips: JSON.parse(playerAShips || "[]"),
    playerBShips: JSON.parse(playerBShips || "[]"),
    playerAHits: JSON.parse(playerAHits || "[]"),
    playerBHits: JSON.parse(playerBHits || "[]"),
    playerASunk: JSON.parse(playerASunk || "[]"),
    playerBSunk: JSON.parse(playerBSunk || "[]"),
    playerTurn,
  };
}

export async function isGamePrepared(lobbyId: string) {
  const preparation = await redisClient.hGet(`lobby:${lobbyId}`, "preparation");

  if (preparation === "0") {
    return true;
  }
  return false;
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

  if (tokens.playerAToken === token) {
    return { isValid: true, player: "A" };
  } else if (tokens.playerBToken === token) {
    return { isValid: true, player: "B" };
  }
  return { isValid: false };
}
