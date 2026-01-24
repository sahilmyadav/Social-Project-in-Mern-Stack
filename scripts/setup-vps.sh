#!/bin/bash

# =============================================================================
# VPS Initial Setup Script for Social App
# Run this script on your VPS to set up Docker and the project structure
# Usage: chmod +x scripts/setup-vps.sh && ./scripts/setup-vps.sh
# =============================================================================

set -e

echo "========================================"
echo "   Social App VPS Setup Script"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root (use sudo)${NC}"
    exit 1
fi

# Update system
echo -e "${YELLOW}Updating system packages...${NC}"
apt-get update && apt-get upgrade -y

# Install required packages
echo -e "${YELLOW}Installing required packages...${NC}"
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    ufw \
    fail2ban

# Install Docker
echo -e "${YELLOW}Installing Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh

    # Add current user to docker group
    usermod -aG docker $SUDO_USER

    # Enable Docker service
    systemctl enable docker
    systemctl start docker
else
    echo -e "${GREEN}Docker is already installed${NC}"
fi

# Install Docker Compose (v2)
echo -e "${YELLOW}Installing Docker Compose...${NC}"
if ! docker compose version &> /dev/null; then
    apt-get install -y docker-compose-plugin
else
    echo -e "${GREEN}Docker Compose is already installed${NC}"
fi

# Create project directory
echo -e "${YELLOW}Creating project directory...${NC}"
mkdir -p /opt/social-app
mkdir -p /opt/social-app/certbot/www
mkdir -p /opt/social-app/certbot/conf

# Set permissions
chown -R $SUDO_USER:$SUDO_USER /opt/social-app

# Configure firewall
echo -e "${YELLOW}Configuring firewall...${NC}"
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Configure fail2ban
echo -e "${YELLOW}Configuring fail2ban...${NC}"
systemctl enable fail2ban
systemctl start fail2ban

# Create swap file if not exists (for low memory VPS)
if [ ! -f /swapfile ]; then
    echo -e "${YELLOW}Creating swap file...${NC}"
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# Print Docker version
echo ""
echo -e "${GREEN}========================================"
echo "   Setup Complete!"
echo "========================================"
echo ""
echo "Docker version: $(docker --version)"
echo "Docker Compose version: $(docker compose version)"
echo ""
echo "Next steps:"
echo "1. Clone your repository to /opt/social-app"
echo "2. Configure environment variables"
echo "3. Run: docker compose up -d"
echo "4. Set up SSL with: ./scripts/setup-ssl.sh"
echo "========================================${NC}"
