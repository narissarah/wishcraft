# Simplified Railway Dockerfile - Optimized for reliability and 2025 compliance (v2)
FROM node:20-slim

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Install system dependencies (minimal for reliability)
RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

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

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 railway

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