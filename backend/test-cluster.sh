#!/bin/bash

echo "🧪 Testing Cluster Implementation"
echo "=================================="
echo ""

# Check if Redis is running
echo "1️⃣ Checking Redis connection..."
if redis-cli ping > /dev/null 2>&1; then
    echo "   ✅ Redis is running"
else
    echo "   ❌ Redis is NOT running"
    echo "   💡 Start Redis with: redis-server"
    exit 1
fi

echo ""
echo "2️⃣ Checking Node.js version..."
node --version

echo ""
echo "3️⃣ Checking installed packages..."
if grep -q "@socket.io/redis-adapter" package.json; then
    echo "   ✅ @socket.io/redis-adapter installed"
else
    echo "   ❌ @socket.io/redis-adapter NOT installed"
fi

if grep -q "\"redis\"" package.json; then
    echo "   ✅ redis package installed"
else
    echo "   ❌ redis package NOT installed"
fi

echo ""
echo "4️⃣ Available npm scripts:"
echo "   • npm run dev          - Single process (development)"
echo "   • npm run dev:cluster  - Cluster mode (development)"
echo "   • npm start            - Single process (production)"
echo "   • npm run start:cluster - Cluster mode (production) ⭐"

echo ""
echo "=================================="
echo "✅ Cluster setup verification complete!"
echo ""
echo "📖 Next steps:"
echo "   1. Add REDIS_URL to your .env file"
echo "   2. Test cluster mode: npm run dev:cluster"
echo "   3. Read CLUSTERING_GUIDE.txt for more info"
echo ""
