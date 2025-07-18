# Railway Optimized Dockerfile - Node 22 Alpine for 2025 best practices
FROM node:22-alpine

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Install system dependencies (minimal Alpine packages)
RUN apk add --no-cache \
    openssl \
    ca-certificates \
    curl \
    && rm -rf /var/cache/apk/*

# Create app directory
WORKDIR /app

# Copy package files for better caching
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies (production only for faster build)
RUN npm ci --only=production --no-audit --no-fund

# Copy source code
COPY . .

# Generate Prisma client (simple approach)
RUN npx prisma generate

# Build the application
RUN npm run build

# Create non-root user (Alpine commands)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S -u 1001 -G nodejs railway

# Change ownership
RUN chown -R railway:nodejs /app

# Switch to non-root user
USER railway

# Expose port
EXPOSE 3000

# Simple health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start command
CMD ["npm", "run", "start:production"]