#!/bin/sh
# Simple Docker entrypoint script for WishCraft

set -e

echo "🚀 Starting WishCraft in production mode (simple)..."
echo "Environment: NODE_ENV=${NODE_ENV}"
echo "Port: ${PORT:-3000}"
echo "Host: ${HOST:-0.0.0.0}"

# Start the application directly
echo "✅ Starting WishCraft application on port ${PORT:-3000}..."
exec node server.js