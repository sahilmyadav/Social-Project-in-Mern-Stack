#!/bin/bash

# =============================================================================
# Backup Script for Social App
# Creates backups of important configuration files
# Usage: ./scripts/backup.sh
# =============================================================================

set -e

APP_DIR="/opt/social-app"
BACKUP_DIR="$APP_DIR/backups"
DATE=$(date +%Y%m%d_%H%M%S)

echo "========================================"
echo "   Creating Backup"
echo "========================================"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup environment files
echo "Backing up configuration..."
tar -czf $BACKUP_DIR/config_$DATE.tar.gz \
    -C $APP_DIR \
    .env \
    backend/.env.production \
    nginx/ \
    2>/dev/null || true

# Backup Redis data
echo "Backing up Redis data..."
docker compose exec -T redis redis-cli BGSAVE
sleep 5
docker cp social-redis:/data/dump.rdb $BACKUP_DIR/redis_$DATE.rdb 2>/dev/null || true

# List backups
echo ""
echo "Available backups:"
ls -lh $BACKUP_DIR

# Clean up old backups (keep last 7 days)
echo ""
echo "Cleaning up old backups..."
find $BACKUP_DIR -type f -mtime +7 -delete

echo ""
echo "========================================"
echo "   Backup Complete!"
echo "========================================"
