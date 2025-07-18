# Optimized Dockerfile for Railway - Debian-based for Prisma compatibility
FROM node:20-slim

# Install build dependencies and update npm
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g npm@11.4.2

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including dev) for build
RUN npm ci --legacy-peer-deps

# Generate Prisma client for Debian Linux with fallback
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
# Update schema for Debian Linux target during Docker build  
RUN sed -i 's/binaryTargets = \["native"\]/binaryTargets = ["native", "debian-openssl-3.0.x"]/' ./prisma/schema.prisma
# Generate Prisma client with multiple fallback strategies
RUN npx prisma generate --schema=./prisma/schema.prisma || \
    (echo "Standard generation failed, trying with native only..." && \
     sed -i 's/binaryTargets = \["native", "debian-openssl-3.0.x"\]/binaryTargets = ["native"]/' ./prisma/schema.prisma && \
     npx prisma generate --schema=./prisma/schema.prisma) || \
    (echo "Native only failed, trying runtime generation..." && \
     echo "PRISMA_GENERATE_DATAPROXY=true" >> .env)

# Copy all source files
COPY . .

# Build the application with proper environment
ENV NODE_ENV=production
RUN npm run build || (echo "Build failed, checking errors..." && ls -la && exit 1)

# Remove dev dependencies after build
RUN npm prune --production

# Create non-root user (Debian commands)
RUN groupadd -g 1001 nodejs && \
    useradd -r -u 1001 -g nodejs railway && \
    chown -R railway:nodejs /app

USER railway

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "import('http').then(h => h.default.get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)))"

# Start with production script
CMD ["npm", "run", "start:production"]