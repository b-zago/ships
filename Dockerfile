# --- Build the frontend (vite outputs to ../backend/public) ---
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# --- Build the backend (tsc -> dist) ---
FROM node:22-alpine AS backend
WORKDIR /app
COPY backend/package*.json ./
RUN npm install
COPY backend/ .
RUN npm run build

# --- Runtime image ---
FROM node:22-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm install --omit=dev

# Compiled server + bundled frontend (served from /app/public)
COPY --from=backend /app/dist ./dist
COPY --from=frontend /app/backend/public ./public

# App port and Prometheus metrics port
EXPOSE 3000 9000

CMD ["npm", "run", "start"]
