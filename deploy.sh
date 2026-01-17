#!/bin/bash

# ============================================
# Social Media App - VPS Deployment Script
# ============================================

set -e

echo "🚀 Social Media App - VPS Deployment"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}Installing Docker...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo -e "${GREEN}Docker installed!${NC}"
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${YELLOW}Installing Docker Compose...${NC}"
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}Docker Compose installed!${NC}"
fi

# Create .env file if not exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file from .env.production...${NC}"
    cp .env.production .env
    echo -e "${RED}⚠️  Please edit .env file with your actual credentials!${NC}"
    echo -e "${RED}   Especially CLOUDFLARE_TUNNEL_TOKEN${NC}"
    exit 1
fi

# Check for Cloudflare Tunnel Token
if grep -q "your-cloudflare-tunnel-token-here" .env; then
    echo -e "${RED}⚠️  Please set CLOUDFLARE_TUNNEL_TOKEN in .env file!${NC}"
    echo ""
    echo "To get a Cloudflare Tunnel Token:"
    echo "1. Go to https://dash.cloudflare.com"
    echo "2. Navigate to Zero Trust -> Networks -> Tunnels"
    echo "3. Create a new tunnel"
    echo "4. Copy the token and paste in .env"
    exit 1
fi

echo -e "${GREEN}Starting deployment...${NC}"

# Stop existing containers
echo "Stopping existing containers..."
docker compose down 2>/dev/null || true

# Build and start containers
echo "Building and starting containers..."
docker compose up -d --build

# Wait for services to be healthy
echo "Waiting for services to start..."
sleep 30

# Check service status
echo ""
echo "======================================"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo "======================================"
echo ""
docker compose ps
echo ""
echo "📊 Service URLs:"
echo "   - Frontend: http://localhost:3000"
echo "   - Backend:  http://localhost:3333"
echo "   - MongoDB:  mongodb://localhost:27017"
echo "   - Redis:    redis://localhost:6379"
echo ""
echo "🌐 Your app is now accessible via Cloudflare Tunnel!"
echo ""
echo "📝 Useful commands:"
echo "   - View logs:     docker compose logs -f"
echo "   - Stop:          docker compose down"
echo "   - Restart:       docker compose restart"
echo "   - Rebuild:       docker compose up -d --build"
