# Railway Optimized Multi-Stage Dockerfile - Shopify 2025 Compliant
# Stage 1: Build stage with all dependencies
FROM node:22-slim AS builder

# Install system dependencies for build
RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Set build environment
ENV NODE_ENV=development
ENV CI=false

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including devDependencies) for build
RUN npm ci --no-audit --no-fund

# Copy source code
COPY . .

# Generate Prisma client with proper targets
RUN npx prisma generate

# Build the application
RUN npm run build

# Stage 2: Production runtime
FROM node:22-slim AS runtime

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV CI=false

# Install only production system dependencies
RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install only production dependencies using modern flag
RUN npm ci --omit=dev --no-audit --no-fund

# Copy built application from builder stage
COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public
COPY --from=builder /app/app ./app
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy other necessary files
COPY shopify.app.toml ./
COPY remix.config.js ./
COPY vite.config.ts ./

# Generate Prisma client for production
RUN npx prisma generate

# Create non-root user
RUN groupadd -g 1001 nodejs && \
    useradd -r -u 1001 -g nodejs railway

# Change ownership
RUN chown -R railway:nodejs /app

# Switch to non-root user
USER railway

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start command
CMD ["npm", "run", "start:production"]