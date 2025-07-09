#!/bin/sh
# Docker entrypoint script for WishCraft

set -e

echo "🚀 Starting WishCraft in production mode..."

# Check if database is accessible
echo "🔍 Checking database connectivity..."
if ! node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.\$connect()
  .then(() => {
    console.log('✅ Database connection successful');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  });
"; then
  echo "❌ Database is not accessible. Exiting..."
  exit 1
fi

# Run database migrations
echo "🗄️ Running database migrations..."
npx prisma migrate deploy

# Start the application
echo "✅ Starting WishCraft application..."
exec npm start