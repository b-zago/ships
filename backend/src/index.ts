import express from "express";
import { createClient } from "redis";

const app = express();
const PORT = process.env.PORT || 3000;

const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
  },
});

redisClient.connect().catch(console.error);

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok bro gegegagagugu" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
