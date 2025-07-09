#!/bin/bash
# Test script to verify server configuration

echo "🧪 Testing WishCraft server locally..."

# Set test environment
export NODE_ENV=production
export PORT=3333
export HOST=0.0.0.0

# Start server in background
echo "Starting server on port $PORT..."
node server.js &
SERVER_PID=$!

# Wait for server to start
sleep 5

# Test health endpoint
echo "Testing health endpoint..."
curl -f http://localhost:$PORT/health

# Check if curl was successful
if [ $? -eq 0 ]; then
    echo "✅ Health check passed!"
else
    echo "❌ Health check failed!"
fi

# Kill the server
kill $SERVER_PID

echo "Test complete."