# WishCraft Production Dockerfile
# Multi-stage build for optimized production image

# ===== Build Stage =====
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    && ln -sf python3 /usr/bin/python

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --production=false

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build application
ENV NODE_ENV=production
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# ===== Production Stage =====
FROM node:18-alpine AS production

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Set working directory
WORKDIR /app

# Install production system dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Copy built application from builder stage
COPY --from=builder --chown=nextjs:nodejs /app/build ./build
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package*.json ./
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Copy additional production files
COPY --chown=nextjs:nodejs deploy/docker-entrypoint.sh ./
COPY --chown=nextjs:nodejs deploy/healthcheck.js ./

# Make scripts executable
RUN chmod +x ./docker-entrypoint.sh

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Expose port
EXPOSE 3000

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node healthcheck.js

# Switch to non-root user
USER nextjs

# Start application using dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["./docker-entrypoint.sh"]

# Labels for better container management
LABEL org.opencontainers.image.title="WishCraft"
LABEL org.opencontainers.image.description="Shopify Gift Registry App"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.vendor="WishCraft"
LABEL org.opencontainers.image.licenses="MIT"