# Railway Optimized Dockerfile - Node 22 Debian Slim for maximum reliability
FROM node:22-slim

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Install system dependencies (Debian packages for better compatibility)
RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    curl \
    python3 \
    make \
    g++ \
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

# Generate Prisma client with Debian target
RUN sed -i 's/binaryTargets = \["native"\]/binaryTargets = ["native", "debian-openssl-3.0.x"]/' ./prisma/schema.prisma
RUN npx prisma generate

# Build the application
RUN npm run build

# Create non-root user (Debian commands)
RUN groupadd -g 1001 nodejs && \
    useradd -r -u 1001 -g nodejs railway

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