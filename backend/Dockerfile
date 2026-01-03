FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Debug output
RUN echo "=== Contents of /app ===" && ls -la
RUN echo "=== Contents of /app/src ===" && ls -la src/
RUN echo "=== Running build ===" && npm run build
RUN echo "=== Build exit code: $?" 
RUN echo "=== Contents of /app after build ===" && ls -la
RUN echo "=== Contents of /app/dist ===" && ls -la dist/ || echo "DIST FOLDER DOES NOT EXIST"
RUN echo "=== Checking for index.js ===" && test -f dist/index.js && echo "index.js EXISTS" || echo "index.js MISSING"

EXPOSE 3000

CMD ["npm", "run", "start"]