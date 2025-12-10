import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import crypto from "crypto";
import cookieParser from "cookie-parser";
import type { Lobby } from "./types.js";
import {
  getLobbyTokens,
  redisClient,
  saveLobby,
  setPlayerBToken,
  validateToken,
} from "./redis.js";

const app = express();
app.use(cookieParser());
const PORT = process.env.PORT || 3000;

//http server
const server = createServer(app);

//socket.io server
const io = new Server(server, {
  cors: {
    origin: "*", // Configure this based on your frontend
    credentials: true,
  },
});

const lobbies = new Map();

redisClient.connect().catch(console.error);

app.use(express.json());

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
    const lobby = {
      id: lobbyId,
      playerAToken: token,
      playerBToken: "",
      playerAShips: [],
      playerBShips: [],
      playerAHits: [],
      playerBHits: [],
      status: "Preparing",
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

app.get("/lobby/join/:lobbyid", async (req, res) => {
  const lobbyId = req.params.lobbyid;

  let token = req.cookies.token;

  if (token) {
    //go to game here
    return res.json({
      status: "ok!",
    });
  }

  if (await !redisClient.exists(`lobby:${lobbyId}`)) {
    return res.json({
      status: "error",
      message: "There is no lobby of this ID!",
    });
  }

  const lobbyTokens = await getLobbyTokens(lobbyId);

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

  res.json({
    //go to game here
    status: "ok!",
  });
});

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

  next(); // Allow connection
});

app.get("/health", (req, res) => {
  res.json({ status: "ok!" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
