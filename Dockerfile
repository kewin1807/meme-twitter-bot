# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Expose port
ENV PORT=3000
EXPOSE $PORT

# Create start script
RUN echo '#!/bin/sh\n\
  npm run start & npm run scheduler\n\
  wait' > start.sh && chmod +x start.sh

# Start both services
CMD ["./start.sh"] 