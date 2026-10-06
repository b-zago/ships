FROM node:22-alpine

WORKDIR /app

COPY backend/package*.json ./
RUN npm install

COPY backend/ .

RUN npm run build

# App port and Prometheus metrics port
EXPOSE 3000 9000

CMD ["npm", "run", "start"]
