# Build stage
FROM --platform=linux/amd64 node:18-alpine AS builder

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

# Install build dependencies
RUN apk add --no-cache python3 make g++ gcc

WORKDIR /usr/src/app

# Copy package files and prisma schema
COPY package*.json ./
COPY pnpm-lock.yaml ./
COPY tsconfig.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install -g pnpm
RUN pnpm install

# Generate Prisma Client with specific schema path
RUN pnpm prisma generate --schema=./prisma/schema.prisma

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN pnpm run build

# Production stage
FROM --platform=linux/amd64 node:18-alpine

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

# Install production dependencies
RUN apk add --no-cache python3 make g++ gcc

WORKDIR /usr/src/app

# Copy package files and prisma schema
COPY package*.json ./
COPY pnpm-lock.yaml ./
COPY prisma ./prisma/

# Install production dependencies and generate Prisma Client
RUN npm install -g pnpm
RUN pnpm install --prod
RUN pnpm prisma generate --schema=./prisma/schema.prisma

# Copy built files from builder
COPY --from=builder /usr/src/app/dist ./dist

# Add a startup script
COPY start.sh .
RUN chmod +x start.sh

ENV PORT=3000
EXPOSE $PORT

CMD ["./start.sh"]

# Create start script with absolute path and proper line endings

# Start both services using absolute pat