# Build stage
FROM node:18-alpine AS builder

# Define ALL build arguments based on your .env file
ARG DATABASE_URL
ARG XAI_API_KEY
ARG TELEGRAM_BOT_TOKEN
ARG TWITTER_USERNAME
ARG TWITTER_PASSWORD
ARG TELEGRAM_CHANNEL_ID

# Set environment variables for build stage
ENV DATABASE_URL=$DATABASE_URL
ENV XAI_API_KEY=$XAI_API_KEY
ENV TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN
ENV TWITTER_USERNAME=$TWITTER_USERNAME
ENV TWITTER_PASSWORD=$TWITTER_PASSWORD
ENV TELEGRAM_CHANNEL_ID=$TELEGRAM_CHANNEL_ID

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /usr/src/app

# Copy package files and prisma schema
COPY package*.json ./
COPY pnpm-lock.yaml ./
COPY tsconfig.json ./
COPY prisma ./prisma/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma Client with specific schema path
RUN pnpm prisma generate --schema=./prisma/schema.prisma

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN pnpm run build

# Production stage
FROM node:18-alpine

# Define build arguments again for production stage
ARG DATABASE_URL
ARG XAI_API_KEY
ARG TELEGRAM_BOT_TOKEN
ARG TWITTER_USERNAME
ARG TWITTER_PASSWORD
ARG TELEGRAM_CHANNEL_ID

# Set environment variables for production
ENV DATABASE_URL=$DATABASE_URL
ENV XAI_API_KEY=$XAI_API_KEY
ENV TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN
ENV TWITTER_USERNAME=$TWITTER_USERNAME
ENV TWITTER_PASSWORD=$TWITTER_PASSWORD
ENV TELEGRAM_CHANNEL_ID=$TELEGRAM_CHANNEL_ID

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /usr/src/app

# Copy package files and prisma schema
COPY package*.json ./
COPY pnpm-lock.yaml ./
COPY prisma ./prisma/

# Install production dependencies and generate Prisma Client
RUN pnpm install --prod --frozen-lockfile && \
  pnpm prisma generate --schema=./prisma/schema.prisma

# Copy built files from builder
COPY --from=builder /usr/src/app/dist ./dist

# Create start script with absolute path and proper line endings
ENV PORT=3000
EXPOSE $PORT
# Start both services using absolute path
CMD ["pnpm", "start"] 