# Multi-stage Dockerfile for WishCraft Shopify App
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache libc6-compat python3 make g++

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install production dependencies
RUN npm ci --only=production

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache libc6-compat python3 make g++

# Copy package files and install all dependencies
COPY package*.json ./
RUN npm ci

# Copy application code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install runtime dependencies
RUN apk add --no-cache libc6-compat

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S shopify -u 1001

# Copy production dependencies
COPY --from=deps --chown=shopify:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=shopify:nodejs /app/package*.json ./

# Copy built application
COPY --from=builder --chown=shopify:nodejs /app/build ./build
COPY --from=builder --chown=shopify:nodejs /app/public ./public
COPY --from=builder --chown=shopify:nodejs /app/prisma ./prisma

# Copy server and configuration files
COPY --chown=shopify:nodejs server.js ./
COPY --chown=shopify:nodejs remix.config.js ./
COPY --chown=shopify:nodejs shopify.app.toml ./

# Switch to non-root user
USER shopify

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); });"

# Start the application
CMD ["node", "server.js"]