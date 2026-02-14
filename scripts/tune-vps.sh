#!/usr/bin/env bash
# ============================================================================
# VPS Performance Tuning Script for ClickME
# ============================================================================
# VPS: Intel i7-8700T (12 threads) / 46GB RAM / 1.6TB SSD
# Run as root: sudo bash scripts/tune-vps.sh
# ============================================================================

set -euo pipefail

echo "═══════════════════════════════════════════════════════════════"
echo "  ClickME VPS Performance Tuning"
echo "  Target: 12-core / 46GB RAM"
echo "═══════════════════════════════════════════════════════════════"

# ─── 1. Kernel Network Stack Tuning ─────────────────────────────────────────
echo ""
echo "► Tuning kernel network parameters..."

cat > /etc/sysctl.d/99-clickme-perf.conf << 'EOF'
# ─── Network Performance ───
# Increase max connections
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 65535
net.ipv4.tcp_max_syn_backlog = 65535

# Increase port range
net.ipv4.ip_local_port_range = 1024 65535

# Enable TCP reuse (critical for high-traffic reverse proxy)
net.ipv4.tcp_tw_reuse = 1

# TCP keepalive (detect dead connections faster)
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_intvl = 60
net.ipv4.tcp_keepalive_probes = 5

# TCP buffer sizing for 46GB RAM system
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 87380 16777216

# Enable TCP Fast Open (reduces handshake latency)
net.ipv4.tcp_fastopen = 3

# ─── Memory / VM ───
# Reduce swappiness — prefer keeping data in RAM
vm.swappiness = 10
# Don't overcommit memory
vm.overcommit_memory = 1
# Increase inotify limits (for Node.js file watchers)
fs.inotify.max_user_watches = 524288
fs.inotify.max_user_instances = 1024

# ─── File Descriptors ───
fs.file-max = 2097152
fs.nr_open = 2097152
EOF

sysctl -p /etc/sysctl.d/99-clickme-perf.conf
echo "  ✓ Kernel parameters applied"

# ─── 2. File Descriptor Limits ──────────────────────────────────────────────
echo ""
echo "► Setting file descriptor limits..."

cat > /etc/security/limits.d/99-clickme.conf << 'EOF'
# ClickME file descriptor limits
* soft nofile 65535
* hard nofile 65535
root soft nofile 65535
root hard nofile 65535
* soft nproc 65535
* hard nproc 65535
EOF
echo "  ✓ File descriptor limits set (65535)"

# ─── 3. Nginx Tuning ────────────────────────────────────────────────────────
echo ""
echo "► Configuring Nginx worker processes..."

if command -v nginx &> /dev/null; then
    # Create cache directory
    mkdir -p /var/cache/nginx/social
    chown www-data:www-data /var/cache/nginx/social 2>/dev/null || chown nginx:nginx /var/cache/nginx/social 2>/dev/null || true

    # Check if nginx.conf has worker_processes auto
    if grep -q "worker_processes" /etc/nginx/nginx.conf; then
        sed -i 's/worker_processes.*/worker_processes auto;/' /etc/nginx/nginx.conf
    fi

    # Set worker_rlimit_nofile
    if ! grep -q "worker_rlimit_nofile" /etc/nginx/nginx.conf; then
        sed -i '/worker_processes/a worker_rlimit_nofile 65535;' /etc/nginx/nginx.conf
    fi

    # Set worker_connections in events block
    if grep -q "worker_connections" /etc/nginx/nginx.conf; then
        sed -i 's/worker_connections.*/worker_connections 4096;/' /etc/nginx/nginx.conf
    fi

    # Add multi_accept if not present
    if ! grep -q "multi_accept" /etc/nginx/nginx.conf; then
        sed -i '/worker_connections/a \        multi_accept on;' /etc/nginx/nginx.conf
    fi

    # Test and reload
    nginx -t && systemctl reload nginx
    echo "  ✓ Nginx tuned: auto workers, 4096 connections, 65535 file limit"
else
    echo "  ⚠ Nginx not found — skip"
fi

# ─── 4. MongoDB Tuning ──────────────────────────────────────────────────────
echo ""
echo "► MongoDB tuning is set in docker-compose.yml:"
echo "  - WiredTiger cache: 8GB"
echo "  - Block compressor: snappy"
echo "  - Journal compressor: snappy"

# ─── 5. Docker Daemon Tuning ────────────────────────────────────────────────
echo ""
echo "► Tuning Docker daemon..."

mkdir -p /etc/docker
cat > /etc/docker/daemon.json << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "3"
  },
  "storage-driver": "overlay2",
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 65535,
      "Soft": 65535
    }
  },
  "max-concurrent-downloads": 10,
  "max-concurrent-uploads": 5
}
EOF

if systemctl is-active --quiet docker; then
    systemctl restart docker
    echo "  ✓ Docker daemon restarted with optimized settings"
else
    echo "  ⚠ Docker not running — settings will apply on next start"
fi

# ─── 6. Transparent Huge Pages (disable for MongoDB) ────────────────────────
echo ""
echo "► Disabling Transparent Huge Pages (improves MongoDB latency)..."

if [ -f /sys/kernel/mm/transparent_hugepage/enabled ]; then
    echo never > /sys/kernel/mm/transparent_hugepage/enabled
    echo never > /sys/kernel/mm/transparent_hugepage/defrag
    echo "  ✓ THP disabled"

    # Make it persist across reboots
    if ! grep -q "transparent_hugepage" /etc/rc.local 2>/dev/null; then
        echo 'echo never > /sys/kernel/mm/transparent_hugepage/enabled' >> /etc/rc.local
        echo 'echo never > /sys/kernel/mm/transparent_hugepage/defrag' >> /etc/rc.local
        chmod +x /etc/rc.local 2>/dev/null || true
    fi
fi

# ─── Summary ────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅ VPS Tuning Complete!"
echo ""
echo "  Resource Allocation:"
echo "  ┌──────────────┬────────┬─────────┐"
echo "  │ Service      │ CPUs   │ RAM     │"
echo "  ├──────────────┼────────┼─────────┤"
echo "  │ Backend (×6) │ 6 cores│ 8 GB    │"
echo "  │ Frontend     │ 3 cores│ 4 GB    │"
echo "  │ MongoDB      │ 2 cores│ 12 GB   │"
echo "  │ Redis        │ 1 core │ 5 GB    │"
echo "  │ Nginx + OS   │ ~spare │ ~17 GB  │"
echo "  └──────────────┴────────┴─────────┘"
echo ""
echo "  Next steps:"
echo "  1. cd /path/to/social-app"
echo "  2. sudo docker compose down && sudo docker compose up -d --build"
echo "  3. sudo bash scripts/tune-vps.sh   (this script)"
echo "  4. Verify: docker stats"
echo "═══════════════════════════════════════════════════════════════"
