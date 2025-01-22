# Build stage
FROM node:18-alpine AS builder

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