import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";
import crypto from "crypto";
import cookieParser from "cookie-parser";
import type { Lobby } from "./types.js";
import {
  getLobbyInfo,
  getLobbyTokens,
  isGamePrepared,
  redisClient,
  saveLobby,
  setPlayerBToken,
  validateToken,
} from "./redis.js";
import { setupSocketHandlers } from "./socketHandler.js";
import { generateHitBoard } from "./util.js";

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//http server
const server = createServer(app);

//socket.io server
const io = new Server(server, {
  cors: {
    origin: false, // Configure this based on your frontend
    credentials: true,
  },
});

redisClient.connect().catch(console.error);

// app.use(
//   cors({
//     origin: "http://localhost:5173",
//     credentials: true,
//   })
// );
app.use(cookieParser());
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, private"
  );
  next();
});

async function generateLobbyId() {
  let lobbyId;
  const maxAttempts = 5;

  for (let i = 0; i < maxAttempts; i++) {
    lobbyId = crypto.randomBytes(8).toString("hex");

    //if id is unique - break
    if (!(await redisClient.exists(`lobby:${lobbyId}`))) {
      return lobbyId;
    }

    if (i === 5) {
      throw new Error("Failed to generate unique lobby ID");
    }
  }
}

// Create a new lobby
app.post("/api/lobby/create", async (req, res) => {
  try {
    const lobbyId = await generateLobbyId();

    const token = crypto.randomBytes(32).toString("hex");
    const lobby: Lobby = {
      id: lobbyId as string,
      playerAToken: token,
      playerBToken: "",
      playerAShips: [],
      playerBShips: [],
      playerAHits: [],
      playerBHits: [],
      playerASunk: [],
      playerBSunk: [],
      playerTurn: "A",
      playerAReady: "0",
      playerBReady: "0",
      preparation: "1",
    };

    //lobbies.set(lobbyId, { playerA: token });

    //saving lobby with correct token to redi
    await saveLobby(lobby);

    res.cookie("token", token, {
      maxAge: 7200000, // milliseconds
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    });

    res.cookie("lobbyId", lobbyId, {
      maxAge: 7200000, // milliseconds
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    });

    res.json({
      url: `${req.protocol}://${req.get("host")}/game/${lobbyId}`,
    });
  } catch (error) {
    console.error("Error creating lobby:", error);
    res
      .status(500)
      .json({ error: "Failed to create lobby. Please try again in a while." });
  }
});

app.get("/api/lobby/join/:lobbyId", async (req, res) => {
  const lobbyId = req.params.lobbyId;
  let token = req.cookies.token;
  const cookieLobbyId = req.cookies.lobbyId;

  console.log("cookies token:", token);

  const isLobbyReal = await redisClient.exists(`lobby:${lobbyId}`);

  if (!isLobbyReal) {
    return res.json({
      status: "error",
      message: "There is no lobby of this ID!",
    });
  }

  const tokenInfo = await validateToken(cookieLobbyId, token);

  console.log(tokenInfo);

  if (tokenInfo.isValid) {
    const isPrepared = await isGamePrepared(cookieLobbyId);

    if (isPrepared) {
      const gameInfo = await getLobbyInfo(cookieLobbyId);
      console.log("token validated!");

      if (tokenInfo.player === "A") {
        return res.json({
          status: "ok!",
          isPrepared,
          playerShips: gameInfo.playerAShips,
          playerHits: generateHitBoard(
            gameInfo.playerBHits,
            gameInfo.playerAShips,
            gameInfo.playerASunk
          ),
          enemyHits: generateHitBoard(
            gameInfo.playerAHits,
            gameInfo.playerBShips,
            gameInfo.playerBSunk
          ),
          playerTurn: gameInfo.playerTurn,
          player: "A",
        });
      } else if (tokenInfo.player === "B") {
        return res.json({
          status: "ok!",
          isPrepared,
          playerShips: gameInfo.playerBShips,
          playerHits: generateHitBoard(
            gameInfo.playerAHits,
            gameInfo.playerBShips,
            gameInfo.playerBSunk
          ),
          enemyHits: generateHitBoard(
            gameInfo.playerBHits,
            gameInfo.playerAShips,
            gameInfo.playerASunk
          ),
          playerTurn: gameInfo.playerTurn,
          player: "B",
        });
      }
    }

    //some handling of reconnecting when the game has not started yet
    console.log("token validated!");
    return res.json({
      status: "ok!",
    });
  }

  const lobbyTokens = await getLobbyTokens(lobbyId);

  console.log("tokens:", lobbyTokens);

  // Check if lobby is full
  if (lobbyTokens.playerAToken && lobbyTokens.playerBToken) {
    return res.json({
      status: "error",
      message: "Lobby is full",
    });
  }

  token = crypto.randomBytes(32).toString("hex");

  res.cookie("token", token, {
    maxAge: 7200000, // milliseconds
    httpOnly: true,
    secure: true,
    sameSite: "strict",
  });

  res.cookie("lobbyId", lobbyId, {
    maxAge: 7200000, // milliseconds
    httpOnly: true,
    secure: true,
    sameSite: "strict",
  });

  await setPlayerBToken(lobbyId, token);

  console.log("new player!");

  res.json({
    //go to game here
    status: "ok!",
  });
});

// SERVE STATIC FILES - After API routes
app.use(express.static(path.join(__dirname, "..", "public")));

// CATCH-ALL ROUTE - Must be last
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

setupSocketHandlers(io);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
