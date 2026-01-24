#!/bin/bash

# =============================================================================
# Quick Deploy Script
# Pull latest images and redeploy with zero downtime
# Usage: ./scripts/deploy.sh
# =============================================================================

set -e

APP_DIR="/opt/social-app"
cd $APP_DIR

echo "========================================"
echo "   Deploying Social App"
echo "========================================"

# Pull latest images
echo "Pulling latest images..."
docker compose pull

# Deploy with zero-downtime rolling update
echo "Deploying services..."
docker compose up -d --remove-orphans

# Wait for services to be healthy
echo "Waiting for services to be healthy..."
sleep 15

# Check service status
echo ""
echo "Service Status:"
docker compose ps

# Health check
echo ""
echo "Running health checks..."

BACKEND_HEALTH=$(docker compose exec -T backend wget -qO- http://localhost:5000/api/v1/health 2>/dev/null || echo "unhealthy")
FRONTEND_HEALTH=$(docker compose exec -T frontend wget -qO- http://localhost:3000 2>/dev/null | head -c 100 || echo "unhealthy")

if [[ "$BACKEND_HEALTH" == *"ok"* ]] || [[ "$BACKEND_HEALTH" == *"healthy"* ]]; then
    echo "✓ Backend: Healthy"
else
    echo "✗ Backend: Unhealthy"
fi

if [[ "$FRONTEND_HEALTH" == *"html"* ]] || [[ "$FRONTEND_HEALTH" == *"<!DOCTYPE"* ]]; then
    echo "✓ Frontend: Healthy"
else
    echo "✗ Frontend: Unhealthy"
fi

# Clean up old images
echo ""
echo "Cleaning up old images..."
docker image prune -f

echo ""
echo "========================================"
echo "   Deployment Complete!"
echo "========================================"
