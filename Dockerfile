# Railway Deployment Dockerfile for WishCraft - 2025 Shopify Compliant
# Optimized for Railway with fast startup and proper database handling

FROM node:18.20.0-alpine AS base

# Install security updates and required packages
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init curl python3 make g++ libc6-compat openssl && \
    rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including dev for building)
RUN npm ci --legacy-peer-deps && npm cache clean --force

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies for production
RUN npm ci --only=production --legacy-peer-deps && npm cache clean --force

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Create necessary directories
RUN mkdir -p /app/logs && chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port (Railway will override this)
EXPOSE 3000

# Health check optimized for Railway
HEALTHCHECK --interval=30s --timeout=30s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3000}/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application with production command
CMD ["npm", "run", "start:production"]