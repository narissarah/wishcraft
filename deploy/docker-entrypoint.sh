#!/bin/sh
# Docker entrypoint script for WishCraft

set -e

echo "🚀 Starting WishCraft in production mode..."
echo "Environment: NODE_ENV=${NODE_ENV}"
echo "Port: ${PORT:-3000}"
echo "Host: ${HOST:-0.0.0.0}"

# Wait for database to be ready (with timeout)
echo "🔍 Waiting for database connection..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if node -e "
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    prisma.\$connect()
      .then(() => {
        console.log('✅ Database connection successful');
        process.exit(0);
      })
      .catch((err) => {
        console.error('⏳ Database not ready yet:', err.message);
        process.exit(1);
      });
  " 2>/dev/null; then
    break
  fi
  
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "⏳ Attempt $RETRY_COUNT/$MAX_RETRIES - Waiting for database..."
  sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "❌ Database connection failed after $MAX_RETRIES attempts"
  echo "Please check your DATABASE_URL environment variable"
  exit 1
fi

# Generate Prisma client (in case it wasn't generated in build)
echo "🔧 Ensuring Prisma client is generated..."
npx prisma generate

# Run database migrations
echo "🗄️ Running database migrations..."
if npx prisma migrate deploy; then
  echo "✅ Database migrations completed"
else
  echo "⚠️ Migration deployment failed, trying db push instead..."
  npx prisma db push --accept-data-loss || echo "⚠️ DB push also failed, but continuing..."
fi

# Start the application
echo "✅ Starting WishCraft application on port ${PORT:-3000}..."
exec npm start