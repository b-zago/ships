# Ships

A real-time multiplayer Battleship game. Create or join a lobby, place your ships, and take turns attacking — no account needed.

## How it works

- Create a lobby and share the code, or join an existing one
- Place your ships on the board before the game starts
- Take turns firing at each other's grid until one fleet is sunk
- Game state is stored in Redis per lobby — lobbies expire after both players disconnect

## Stack

- **Frontend** — React + Vite + Tailwind
- **Backend** — Node.js + Express + TypeScript
- **Real-time** — Socket.IO
- **State** — Redis

## Dev Scripts

Run the backend with Docker (includes Redis):

- `docker compose -f dev-docker/docker-compose.yml up` - start backend + Redis with live reload

Run the frontend separately:

- `npm run dev` - start the Vite dev server
