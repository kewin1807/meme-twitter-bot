# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy dependency files
COPY package*.json pnpm-lock.yaml ./
COPY tsconfig.json ./

# Install all dependencies
RUN pnpm install

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN pnpm build

# Production stage
FROM node:20-alpine

# Define environment variables
ARG XAI_API_KEY
ARG TELEGRAM_BOT_TOKEN
ARG TWITTER_USERNAME
ARG TWITTER_PASSWORD
ARG TELEGRAM_CHANNEL_ID
ARG TWITTER_EMAIL
ARG TWITTER_TWO_FACTOR_SECRET

ENV XAI_API_KEY=$XAI_API_KEY
ENV TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN
ENV TWITTER_USERNAME=$TWITTER_USERNAME
ENV TWITTER_PASSWORD=$TWITTER_PASSWORD
ENV TELEGRAM_CHANNEL_ID=$TELEGRAM_CHANNEL_ID
ENV TWITTER_EMAIL=$TWITTER_EMAIL
ENV TWITTER_TWO_FACTOR_SECRET=$TWITTER_TWO_FACTOR_SECRET

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files and install production dependencies
COPY package*.json pnpm-lock.yaml ./
RUN pnpm install

# Create data directory for JSON storage
RUN mkdir -p /app/data

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Make sure the data directory is writable
RUN chown -R node:node /app/data

# Switch to non-root user
USER node

CMD ["node", "dist/main.js"]