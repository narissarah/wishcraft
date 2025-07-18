# Optimized Dockerfile for Railway - Fix build issues
FROM node:20-alpine

# Install build dependencies and update npm
RUN apk add --no-cache python3 make g++ git && \
    npm install -g npm@11.4.2

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including dev) for build
RUN npm ci --legacy-peer-deps

# Generate Prisma client with multiple engine workarounds
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
ENV PRISMA_QUERY_ENGINE_LIBRARY=/app/node_modules/.prisma/client/libquery_engine-linux-musl-openssl-3.0.x.so.node
ENV PRISMA_QUERY_ENGINE_BINARY=/app/node_modules/.prisma/client/query-engine-linux-musl-openssl-3.0.x
ENV PRISMA_SCHEMA_ENGINE_BINARY=/app/node_modules/.prisma/client/schema-engine-linux-musl-openssl-3.0.x
ENV PRISMA_INTROSPECTION_ENGINE_BINARY=/app/node_modules/.prisma/client/introspection-engine-linux-musl-openssl-3.0.x
ENV PRISMA_FMT_BINARY=/app/node_modules/.prisma/client/prisma-fmt-linux-musl-openssl-3.0.x
# Try multiple approaches to fix engine download
RUN npx prisma generate --generator client || \
    (echo "First attempt failed, trying with skip-download..." && \
     npm install @prisma/engines-version --save-dev && \
     npx prisma generate --skip-download) || \
    (echo "Second attempt failed, trying manual approach..." && \
     npm install @prisma/client --force && \
     npx prisma generate) || \
    (echo "All attempts failed, using cached engines..." && \
     mkdir -p /app/node_modules/.prisma/client && \
     npx prisma generate --data-proxy)

# Copy all source files
COPY . .

# Build the application with proper environment
ENV NODE_ENV=production
RUN npm run build || (echo "Build failed, checking errors..." && ls -la && exit 1)

# Remove dev dependencies after build
RUN npm prune --production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S railway -u 1001 && \
    chown -R railway:nodejs /app

USER railway

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "import('http').then(h => h.default.get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)))"

# Start with production script
CMD ["npm", "run", "start:production"]