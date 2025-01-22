# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ gcc
RUN npm install -g pnpm

# Copy dependency files
COPY package*.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies)
RUN pnpm install

# Generate Prisma Client
RUN pnpm prisma generate

# Production stage
FROM node:18-alpine

# Define environment variables
ARG DATABASE_URL
ARG XAI_API_KEY
ARG TELEGRAM_BOT_TOKEN
ARG TWITTER_USERNAME
ARG TWITTER_PASSWORD
ARG TELEGRAM_CHANNEL_ID

ENV DATABASE_URL=$DATABASE_URL
ENV XAI_API_KEY=$XAI_API_KEY
ENV TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN
ENV TWITTER_USERNAME=$TWITTER_USERNAME
ENV TWITTER_PASSWORD=$TWITTER_PASSWORD
ENV TELEGRAM_CHANNEL_ID=$TELEGRAM_CHANNEL_ID

WORKDIR /app

# Install production dependencies
RUN apk add --no-cache python3 make g++ gcc
RUN npm install -g pnpm ts-node typescript

# Copy package files and install production dependencies
COPY package*.json pnpm-lock.yaml ./
COPY tsconfig.json ./
COPY prisma ./prisma/
RUN pnpm install --prod

# Generate Prisma Client in production
RUN pnpm prisma generate

# Copy source code
COPY src/ ./src/



CMD ["pnpm", "start:main"]