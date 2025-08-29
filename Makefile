# Makefile for dowhistle-mcp-gateway

# Variables
DOCKER_COMPOSE = docker-compose
SERVICE = mcp-gateway
IMAGE = your-dockerhub-user/dowhistle-mcp-gateway
TAG = latest

# Run in development mode (with hot reload)
dev:
	$(DOCKER_COMPOSE) up

# Run in production mode (optimized build)
prod:
	$(DOCKER_COMPOSE) -f docker-compose.yml up --build

# Stop all containers
down:
	$(DOCKER_COMPOSE) down

# View logs
logs:
	$(DOCKER_COMPOSE) logs -f $(SERVICE)

# Rebuild containers without cache
rebuild:
	$(DOCKER_COMPOSE) build --no-cache

# Clean up everything (containers, networks, volumes, images)
clean:
	$(DOCKER_COMPOSE) down -v --rmi all --remove-orphans

# Build multi-platform image (for AMD64 + ARM64)
buildx:
	docker buildx build \
		--platform linux/amd64,linux/arm64 \
		-t $(IMAGE):$(TAG) \
		.

# Build and push multi-platform image to Docker Hub
push:
	docker buildx build \
		--platform linux/amd64,linux/arm64 \
		-t $(IMAGE):$(TAG) \
		--push .
