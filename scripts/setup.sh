#!/bin/bash

# =============================================================================
# Quick Setup Script for Social App
# Domain: clikkme.in
# Usage: ./scripts/setup.sh
# =============================================================================

set -e

echo "========================================"
echo "   Social App Setup - clikkme.in"
echo "========================================"

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo ""
echo "Step 1: Copying environment files..."

# Copy root .env if not exists
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✓ Created .env from .env.example"
        echo "  Please edit .env with your production values!"
    fi
else
    echo "✓ .env already exists"
fi

# Copy frontend .env if not exists
if [ ! -f "frontend/.env" ]; then
    cat > frontend/.env << 'EOF'
# Backend API URL
NEXT_PUBLIC_API_URL=https://clikkme.in/api/v1
NEXT_PUBLIC_API_BASE_URL=https://clikkme.in/api/v1

# Socket.IO URL
NEXT_PUBLIC_SOCKET_URL=https://clikkme.in

# Encryption Key (must match backend)
NEXT_PUBLIC_ENCRYPTION_KEY=your-super-secret-encryption-key-change-in-production-2024

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=dltbikmc6
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_upload_preset

# Environment
NEXT_PUBLIC_ENV=production
EOF
    echo "✓ Created frontend/.env"
else
    echo "✓ frontend/.env already exists"
fi

echo ""
echo "Step 2: Building Docker images..."
docker compose build --no-cache

echo ""
echo "Step 3: Starting services..."
docker compose up -d

echo ""
echo "Step 4: Waiting for services to start..."
sleep 20

echo ""
echo "Step 5: Checking service status..."
docker compose ps

echo ""
echo "========================================"
echo "   Setup Complete!"
echo "========================================"
echo ""
echo "Your app is now running at:"
echo "  - Frontend: http://localhost:3000"
echo "  - Backend:  http://localhost:5000"
echo ""
echo "For production with domain clikkme.in:"
echo "  1. Configure Nginx with: nginx/clikkme.in.conf"
echo "  2. Setup SSL: ./scripts/setup-ssl.sh clikkme.in your@email.com"
echo ""
echo "Useful commands:"
echo "  make logs    - View all logs"
echo "  make ps      - Check service status"
echo "  make down    - Stop all services"
echo "  make restart - Restart services"
echo ""
