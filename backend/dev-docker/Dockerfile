# Use Node.js LTS version
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port (adjust if your app uses a different port)
EXPOSE 3000

# Use the dev script with watch mode for development
CMD ["npm", "run", "dev"]