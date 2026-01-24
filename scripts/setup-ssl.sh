#!/bin/bash

# =============================================================================
# SSL Certificate Setup Script using Let's Encrypt
# Run this script after your domain is pointing to your VPS
# Usage: chmod +x scripts/setup-ssl.sh && ./scripts/setup-ssl.sh yourdomain.com your@email.com
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check arguments
if [ -z "$1" ] || [ -z "$2" ]; then
    echo -e "${RED}Usage: $0 <domain> <email>${NC}"
    echo "Example: $0 example.com admin@example.com"
    exit 1
fi

DOMAIN=$1
EMAIL=$2
APP_DIR="/opt/social-app"

echo "========================================"
echo "   SSL Setup for $DOMAIN"
echo "========================================"

# Check if running in the right directory
if [ ! -f "$APP_DIR/docker-compose.yml" ]; then
    echo -e "${RED}Error: docker-compose.yml not found in $APP_DIR${NC}"
    exit 1
fi

cd $APP_DIR

# Use initial nginx config (without SSL)
echo -e "${YELLOW}Using initial Nginx config...${NC}"
cp nginx/conf.d/default.conf.initial nginx/conf.d/default.conf

# Update domain in nginx config
sed -i "s/yourdomain.com/$DOMAIN/g" nginx/conf.d/default.conf

# Start nginx with initial config
echo -e "${YELLOW}Starting Nginx...${NC}"
docker compose up -d nginx

# Wait for nginx to start
sleep 5

# Request SSL certificate
echo -e "${YELLOW}Requesting SSL certificate from Let's Encrypt...${NC}"
docker compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN \
    -d www.$DOMAIN

# Check if certificate was created
if [ -d "./certbot/conf/live/$DOMAIN" ]; then
    echo -e "${GREEN}SSL certificate obtained successfully!${NC}"

    # Update to SSL nginx config
    echo -e "${YELLOW}Updating Nginx config for SSL...${NC}"

    # Update domain in SSL config
    sed -i "s/yourdomain.com/$DOMAIN/g" nginx/conf.d/default.conf

    # Copy SSL config
    cp nginx/conf.d/default.conf.ssl nginx/conf.d/default.conf 2>/dev/null || true

    # If default.conf.ssl doesn't exist, update current config
    sed -i "s/yourdomain.com/$DOMAIN/g" nginx/conf.d/default.conf

    # Restart all services
    echo -e "${YELLOW}Restarting all services...${NC}"
    docker compose down
    docker compose up -d

    echo ""
    echo -e "${GREEN}========================================"
    echo "   SSL Setup Complete!"
    echo "========================================"
    echo ""
    echo "Your site is now available at:"
    echo "  https://$DOMAIN"
    echo "  https://www.$DOMAIN"
    echo ""
    echo "SSL certificates will auto-renew via certbot."
    echo "========================================${NC}"
else
    echo -e "${RED}Failed to obtain SSL certificate.${NC}"
    echo "Please check:"
    echo "  1. Your domain is pointing to this server"
    echo "  2. Ports 80 and 443 are open"
    echo "  3. DNS has propagated (may take up to 48 hours)"
    exit 1
fi
