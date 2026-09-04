# Social App - Docker Commands
# Usage: make <command>

.PHONY: help build up down logs restart clean dev prod ssl backup

# Default target
help:
	@echo "Social App - Docker Commands"
	@echo ""
	@echo "Usage: make <command>"
	@echo ""
	@echo "Commands:"
	@echo "  dev        - Start development environment"
	@echo "  prod       - Start production environment"
	@echo "  build      - Build all Docker images"
	@echo "  up         - Start all services"
	@echo "  down       - Stop all services"
	@echo "  restart    - Restart all services"
	@echo "  logs       - View all logs (follow mode)"
	@echo "  logs-b     - View backend logs"
	@echo "  logs-f     - View frontend logs"
	@echo "  logs-n     - View nginx logs"
	@echo "  ps         - List running containers"
	@echo "  clean      - Remove all containers and images"
	@echo "  ssl        - Setup SSL certificate"
	@echo "  backup     - Create backup"
	@echo "  shell-b    - Shell into backend container"
	@echo "  shell-f    - Shell into frontend container"

# Development
dev:
	docker compose -f docker-compose.dev.yml up --build

dev-d:
	docker compose -f docker-compose.dev.yml up --build -d

# Production
prod:
	docker compose up -d

build:
	docker compose build --no-cache

up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

# Logs
logs:
	docker compose logs -f

logs-b:
	docker compose logs -f backend

logs-f:
	docker compose logs -f frontend

logs-n:
	docker compose logs -f nginx

# Status
ps:
	docker compose ps

# Cleanup
clean:
	docker compose down -v --rmi all
	docker system prune -f

# SSL Setup
ssl:
	@read -p "Enter domain: " domain; \
	read -p "Enter email: " email; \
	./scripts/setup-ssl.sh $$domain $$email

# Backup
backup:
	./scripts/backup.sh

# Shell access
shell-b:
	docker compose exec backend sh

shell-f:
	docker compose exec frontend sh

shell-redis:
	docker compose exec redis redis-cli

# Health check
health:
	@echo "Checking backend..."
	@curl -s http://localhost:5000/api/v1/health || echo "Backend not responding"
	@echo "\nChecking frontend..."
	@curl -s http://localhost:3000 | head -c 100 || echo "Frontend not responding"

# Pull and deploy
deploy:
	./scripts/deploy.sh
