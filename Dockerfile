# Optimized Dockerfile for Railway - Fix build issues
FROM node:20-alpine

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including dev) for build
RUN npm ci --legacy-peer-deps

# Generate Prisma client
RUN npx prisma generate

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