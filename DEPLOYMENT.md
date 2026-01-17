# Social Media App - Docker Deployment

## Prerequisites

- VPS with Ubuntu/Debian (2GB+ RAM recommended)
- Domain name (for Cloudflare)
- Cloudflare account (free tier works)

## Quick Deploy to VPS

### 1. Clone the repository on your VPS

```bash
git clone https://github.com/sahilmyadav/social-media-app.git
cd social-media-app
```

### 2. Set up Cloudflare Tunnel

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Zero Trust** → **Networks** → **Tunnels**
3. Click **Create a tunnel**
4. Name it (e.g., `social-media-app`)
5. Copy the tunnel token
6. Configure public hostnames:
   - `your-domain.com` → `http://frontend:3000`
   - `api.your-domain.com` → `http://backend:3333`

### 3. Configure environment

```bash
cp .env.production .env
nano .env  # Edit with your values
```

Update the `.env` file:

```env
CLOUDFLARE_TUNNEL_TOKEN=your-actual-tunnel-token
```

### 4. Deploy

```bash
chmod +x deploy.sh
./deploy.sh
```

## Manual Docker Commands

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop all services
docker compose down

# Rebuild and restart
docker compose up -d --build

# Check status
docker compose ps
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Cloudflare Tunnel                     │
│         (HTTPS termination, DDoS protection)            │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                   Docker Network                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  Frontend   │  │   Backend   │  │   Cloudflared   │  │
│  │  (Next.js)  │  │  (Express)  │  │    (Tunnel)     │  │
│  │  :3000      │  │  :3333      │  │                 │  │
│  └──────┬──────┘  └──────┬──────┘  └─────────────────┘  │
│         │                │                               │
│  ┌──────▼──────┐  ┌──────▼──────┐                       │
│  │   MongoDB   │  │    Redis    │                       │
│  │   :27017    │  │    :6379    │                       │
│  └─────────────┘  └─────────────┘                       │
└─────────────────────────────────────────────────────────┘
```

## Features

- ✅ Automatic HTTPS via Cloudflare
- ✅ DDoS protection
- ✅ Auto-restart on failure
- ✅ Health checks for all services
- ✅ Persistent data volumes
- ✅ Zero-downtime deployments

## Monitoring

```bash
# Check container health
docker compose ps

# View real-time logs
docker compose logs -f

# Check resource usage
docker stats
```

## Troubleshooting

### Container not starting

```bash
docker compose logs backend  # Check backend logs
docker compose logs frontend # Check frontend logs
```

### Database connection issues

```bash
docker compose exec mongodb mongosh  # Access MongoDB shell
```

### Cloudflare Tunnel not working

```bash
docker compose logs cloudflared  # Check tunnel logs
```

## Backup Data

```bash
# Backup MongoDB
docker compose exec mongodb mongodump --out /data/backup

# Copy backup to host
docker cp social-media-mongodb:/data/backup ./backup
```
