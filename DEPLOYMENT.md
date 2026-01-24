# Social App - Docker Deployment Guide

This guide covers deploying the Social App (Backend + Frontend) on a single VPS using Docker with CI/CD pipeline.

## 📁 Project Structure

```
Social/
├── backend/                 # Node.js Express API
│   ├── Dockerfile
│   ├── .dockerignore
│   └── .env.example
├── frontend/                # Next.js Application
│   ├── Dockerfile
│   └── .dockerignore
├── nginx/                   # Reverse Proxy Configuration
│   ├── nginx.conf
│   └── conf.d/
│       ├── default.conf
│       └── default.conf.initial
├── scripts/                 # Deployment Scripts
│   ├── setup-vps.sh
│   ├── setup-ssl.sh
│   ├── deploy.sh
│   └── backup.sh
├── .github/workflows/       # CI/CD Pipeline
│   └── deploy.yml
├── docker-compose.yml       # Production orchestration
├── docker-compose.dev.yml   # Local development
└── .env.example
```

## 🚀 Quick Start

### Prerequisites

- VPS with Ubuntu 20.04+ (minimum 2GB RAM, 2 CPU cores)
- Domain name pointing to your VPS IP
- GitHub account (for CI/CD)
- MongoDB Atlas account or self-hosted MongoDB
- Cloudinary account (for media storage)

### 1. VPS Setup

SSH into your VPS and run the setup script:

```bash
# Download and run setup script
curl -sSL https://raw.githubusercontent.com/YOUR_REPO/main/scripts/setup-vps.sh | sudo bash

# Or clone the repo first
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git /opt/social-app
cd /opt/social-app
chmod +x scripts/*.sh
sudo ./scripts/setup-vps.sh
```

### 2. Configure Environment Variables

```bash
cd /opt/social-app

# Copy environment templates
cp .env.example .env
cp backend/.env.example backend/.env.production

# Edit with your values
nano .env
nano backend/.env.production
```

**Required environment variables:**

| Variable                 | Description                                          |
| ------------------------ | ---------------------------------------------------- |
| `MONGODB_URI`            | MongoDB connection string                            |
| `NEXT_PUBLIC_API_URL`    | Full API URL (e.g., `https://yourdomain.com/api/v1`) |
| `NEXT_PUBLIC_SOCKET_URL` | Socket.IO URL (e.g., `https://yourdomain.com`)       |
| `JWT_SECRET`             | Secret key for JWT tokens                            |
| `CLOUDINARY_*`           | Cloudinary configuration                             |

### 3. Update Domain in Nginx

```bash
# Replace 'yourdomain.com' with your actual domain
sed -i 's/yourdomain.com/your-actual-domain.com/g' nginx/conf.d/default.conf
sed -i 's/yourdomain.com/your-actual-domain.com/g' nginx/conf.d/default.conf.initial
```

### 4. Initial Deployment (HTTP only)

```bash
# Use initial config without SSL
cp nginx/conf.d/default.conf.initial nginx/conf.d/default.conf

# Start services
docker compose up -d

# Check status
docker compose ps
docker compose logs -f
```

### 5. Setup SSL Certificate

```bash
./scripts/setup-ssl.sh yourdomain.com your-email@example.com
```

### 6. Verify Deployment

```bash
# Check all services are running
docker compose ps

# Check logs
docker compose logs backend
docker compose logs frontend
docker compose logs nginx

# Test endpoints
curl https://yourdomain.com/api/v1/health
curl https://yourdomain.com
```

---

## 🔄 CI/CD Pipeline

### GitHub Secrets Required

Go to your repository → Settings → Secrets and Variables → Actions, and add:

| Secret                   | Description                             |
| ------------------------ | --------------------------------------- |
| `VPS_HOST`               | Your VPS IP address                     |
| `VPS_USER`               | SSH username (e.g., `root` or `deploy`) |
| `VPS_SSH_KEY`            | Private SSH key for VPS access          |
| `NEXT_PUBLIC_API_URL`    | Production API URL                      |
| `NEXT_PUBLIC_SOCKET_URL` | Production Socket URL                   |
| `PRODUCTION_URL`         | Your domain URL                         |

### How It Works

1. **On Push to main/master:**
   - Runs tests and linting
   - Builds Docker images
   - Pushes to GitHub Container Registry
   - Deploys to VPS via SSH

2. **Automatic Deployments:**
   - Every push to `main` triggers deployment
   - Uses zero-downtime rolling updates

### Manual Deployment

```bash
# SSH to VPS
ssh user@your-vps-ip

# Run deploy script
cd /opt/social-app
./scripts/deploy.sh
```

---

## 🛠 Common Operations

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f nginx
```

### Restart Services

```bash
# Restart all
docker compose restart

# Restart specific service
docker compose restart backend
```

### Scale Services

```bash
# Scale backend to 3 instances
docker compose up -d --scale backend=3
```

### Update Configuration

```bash
# After editing .env or nginx config
docker compose down
docker compose up -d
```

### Database Operations

```bash
# Access Redis CLI
docker compose exec redis redis-cli

# Clear Redis cache
docker compose exec redis redis-cli FLUSHALL
```

### Backup

```bash
./scripts/backup.sh
```

---

## 📊 Monitoring

### Health Checks

- **Backend:** `GET /api/v1/health`
- **Frontend:** `GET /`
- **Detailed:** `GET /api/v1/health/detailed`

### Resource Usage

```bash
# Container stats
docker stats

# Disk usage
docker system df
```

### Clean Up

```bash
# Remove unused images
docker image prune -a

# Remove everything unused
docker system prune -a
```

---

## 🔧 Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose logs backend

# Check container status
docker compose ps -a

# Rebuild container
docker compose build --no-cache backend
docker compose up -d
```

### SSL Certificate Issues

```bash
# Manually renew certificates
docker compose run --rm certbot renew

# Check certificate status
docker compose exec certbot certbot certificates
```

### Port Already in Use

```bash
# Find process using port
sudo lsof -i :80
sudo lsof -i :443

# Kill process
sudo kill -9 <PID>
```

### Out of Memory

```bash
# Check memory usage
free -h
docker stats --no-stream

# Add swap (if needed)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

---

## 🏗 Architecture

```
                    ┌─────────────────┐
                    │     Internet    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │     Nginx       │
                    │  (Reverse Proxy)│
                    │   Port 80/443   │
                    └────────┬────────┘
                             │
           ┌─────────────────┼─────────────────┐
           │                 │                 │
    ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
    │  Frontend   │   │   Backend   │   │   Socket   │
    │  (Next.js)  │   │  (Express)  │   │  (Socket.io)│
    │   :3000     │   │    :5000    │   │    :5000   │
    └─────────────┘   └──────┬──────┘   └─────────────┘
                             │
                    ┌────────▼────────┐
                    │     Redis       │
                    │   (Cache/Pub)   │
                    │     :6379       │
                    └─────────────────┘
                             │
                    ┌────────▼────────┐
                    │    MongoDB      │
                    │   (External)    │
                    └─────────────────┘
```

---

## 📝 Local Development

```bash
# Build and run locally
docker compose -f docker-compose.dev.yml up --build

# Access
# Frontend: http://localhost:3000
# Backend: http://localhost:5000
# Redis: localhost:6379
```

---

## 🔐 Security Best Practices

1. **Never commit `.env` files** - Use `.env.example` templates
2. **Use strong secrets** - Generate with `openssl rand -hex 32`
3. **Keep dependencies updated** - Run `npm audit` regularly
4. **Enable firewall** - Only open ports 80, 443, 22
5. **Use fail2ban** - Protect against brute force attacks
6. **Regular backups** - Use the backup script

---

## 📄 License

MIT License - See LICENSE file for details.
