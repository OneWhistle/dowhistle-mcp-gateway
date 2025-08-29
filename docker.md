# 🚀 Dowhistle MCP Gateway — Docker Guide

This document explains how to **build, run, and deploy** the `dowhistle-mcp-gateway` service using Docker and Docker Compose.

---

## 📦 Build & Run

### 1. Development (hot reload)

Runs with live reload using `docker-compose.override.yml`.

```bash
docker-compose up
```

Rebuild & start fresh:

```bash
docker-compose up --build
```

---

### 2. Production (optimized container)

Runs with multi-stage build (no dev dependencies, compiled TypeScript).

```bash
docker-compose -f docker-compose.yml up --build
```

Stop containers:

```bash
docker-compose down
```

---

## 🔑 Environment Variables

Create a `.env` file in the root directory (this file is **not** copied into Docker images):

```env
OPENAI_API_KEY=sk-xxxx
MCP_SERVER_URL=http://localhost:8000
ALLOWED_ORIGINS=http://localhost:3000
```

---

## 🛠️ Useful Docker Commands

### Logs

```bash
docker-compose logs -f
```

### Rebuild without cache

```bash
docker-compose build --no-cache
```

### Clean everything (⚠️ removes volumes/images/networks)

```bash
docker-compose down -v --rmi all --remove-orphans
```

### Exec into a running container

```bash
docker exec -it dowhistle-mcp-gateway sh
```

---

## 🌍 Multi-Platform Builds

### Build multi-arch image (amd64 + arm64) locally:

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t your-dockerhub-user/dowhistle-mcp-gateway:latest \
  .
```

### Build & push to Docker Hub:

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t your-dockerhub-user/dowhistle-mcp-gateway:latest \
  --push .
```

Pull on any server:

```bash
docker pull your-dockerhub-user/dowhistle-mcp-gateway:latest
```

---

## ⚡ Makefile Shortcuts

If you installed `make`, you can use these shortcuts instead of long docker commands:

```bash
make dev      # start in dev mode
make prod     # start in prod mode
make down     # stop containers
make logs     # view logs
make rebuild  # rebuild without cache
make clean    # remove everything
make push     # build + push multi-arch image to Docker Hub
```

---

## 🤖 GitHub Actions (CI/CD)

The repo includes a workflow in `.github/workflows/docker-publish.yml` that:

* Builds multi-arch images on each push to `main`.
* Pushes to Docker Hub as `:latest` and with commit SHA tags.

Make sure to configure these secrets in GitHub → Repo Settings → Secrets → Actions:

* `DOCKERHUB_USERNAME`
* `DOCKERHUB_TOKEN`

---

## 🛠️ Troubleshooting

### 🔴 Port 3001 already in use

If you see:

```
Error: listen EADDRINUSE: address already in use :::3001
```

It means something else is using port `3001`.
👉 Fix:

* Stop the other process (`lsof -i :3001` then `kill <pid>`), **or**
* Change the exposed port in `docker-compose.yml`:

  ```yaml
  ports:
    - "4000:3001"
  ```

---

### 🔴 Changes not reflected in dev mode

If your edits aren’t showing up:

* Make sure you’re running with **`make dev`** (or `docker-compose up`), not prod.
* Ensure your `volumes:` section in `docker-compose.override.yml` mounts `.` → `/app`.
* Run:

  ```bash
  docker-compose down -v
  docker-compose up --build
  ```

---

### 🔴 Build stuck or using old code

If Docker cache is interfering:

```bash
docker-compose build --no-cache
```

or

```bash
make rebuild
```

---

### 🔴 Multi-arch build fails with "no builder instance"

Enable buildx once:

```bash
docker buildx create --use
```

---

### 🔴 Verify your pushed image supports both amd64 + arm64

```bash
docker buildx imagetools inspect your-dockerhub-user/dowhistle-mcp-gateway:latest
```

Expected output should show both:

```
Platform: linux/amd64
Platform: linux/arm64
```

---

### 🔴 Container keeps restarting

Check logs:

```bash
docker-compose logs -f mcp-gateway
```

If healthcheck is failing, make sure your app has a `/health` route returning `200 OK`.

---

### 🔴 Clear everything (last resort reset)

```bash
docker system prune -af --volumes
```

⚠️ This deletes **all images, containers, networks, and volumes** — use with caution.

---

✅ With this guide you can:

* Run dev & prod locally
* Build portable multi-arch images
* Auto-publish via GitHub Actions
* Troubleshoot common Docker issues quickly

---
