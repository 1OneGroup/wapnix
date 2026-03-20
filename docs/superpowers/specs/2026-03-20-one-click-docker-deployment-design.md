# One-Click Docker Deployment via GHCR

**Date:** 2026-03-20
**Status:** Approved
**Author:** Brainstorming session

## Problem

Wapnix needs a streamlined deployment workflow that serves two audiences:
1. **Internal (Hostinger VPS):** Push to `main` and have the latest image available to pull — no manual builds on the server.
2. **Self-hosted customers:** Run a single `docker compose up -d` to get a working Wapnix instance with zero configuration.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Image registry | GitHub Container Registry (ghcr.io) | Free for public repos, co-located with source code |
| Build trigger | Every push to `main` | Always have latest version available |
| Image tags | `:latest` + `:sha-<short>` | Latest for convenience, SHA for rollback |
| Platform | `linux/amd64` only | Hostinger VPS architecture; ARM can be added later |
| Container architecture | Single container | Backend serves frontend static files; SQLite DB; no benefit to splitting |
| Node version | 22-slim | Latest LTS, supported until April 2027 |
| Secret management | Auto-generate JWT_SECRET on first run | True zero-config experience; persisted in data volume |
| SSL/Reverse proxy | External (not included) | Handled by Hostinger Traefik or customer's own proxy; avoids conflicts with existing services |
| CORS | No changes | Frontend served from same origin (port 4000); accessed via server IP |

## Architecture

```
GitHub (push to main)
    │
    ▼
GitHub Actions
    │ Build multi-stage Docker image
    │ Push to ghcr.io/1onegroup/wapnix:latest
    ▼
ghcr.io/1onegroup/wapnix
    │
    ├──► Hostinger VPS: docker compose pull && docker compose up -d
    │
    └──► Customer server: docker compose up -d (pulls image automatically)
```

### Container Internals

```
┌─────────────────────────────────────────┐
│  Container: wapnix (port 4000)          │
│                                         │
│  docker-entrypoint.sh                   │
│    ├── Auto-generate JWT_SECRET         │
│    ├── Ensure directories exist         │
│    └── exec node backend/server.js      │
│                                         │
│  Node.js 22 (Express)                   │
│    ├── Backend API (/api/*)             │
│    ├── Frontend static (frontend/dist)  │
│    ├── Socket.IO (real-time)            │
│    ├── Baileys (WhatsApp sessions)      │
│    └── SQLite (better-sqlite3)          │
│                                         │
│  Volumes (persistent):                  │
│    ├── /app/backend/data/       ← DB + auth sessions + .jwt_secret │
│    └── /app/backend/uploads/    ← avatars, templates, messages     │
└─────────────────────────────────────────┘
```

## File Changes

### 1. `Dockerfile` (Update)

Changes from current:
- Base image: `node:22-slim` (was `node:18-slim`) — **all three stages must use the same Node major version** to avoid `better-sqlite3` native module ABI mismatch
- Add `COPY docker-entrypoint.sh` and `RUN chmod +x`
- Add missing upload directories: `uploads/messages`, `uploads/templates`
- Change `CMD` to use entrypoint: `ENTRYPOINT ["./docker-entrypoint.sh"]`
- Pre-create volume directories with correct `wapnix` ownership before `USER wapnix` — Docker named volumes inherit image directory contents on first mount, ensuring the non-root user can write to them
- Increase healthcheck `--start-period` from 15s to 60s (Baileys session restoration may take longer with multiple users)

Multi-stage build stays the same:
- Stage 1: Build frontend (`npm ci` + `npm run build`)
- Stage 2: Install backend production deps (`npm ci --omit=dev`, includes `python3`, `make`, `g++`, `git` for `better-sqlite3` and Baileys)
- Stage 3: Production image (copy built artifacts, non-root user, healthcheck)

**Note on volume ownership:** Named Docker volumes inherit directory contents and ownership from the image on first mount. Since directories are created and chowned to `wapnix` before `USER wapnix`, this works automatically. Bind mounts do NOT inherit — customers using bind mounts must ensure correct ownership (`chown -R 1000:1000 ./data ./uploads`).

### 2. `docker-entrypoint.sh` (New)

```
#!/bin/sh
set -e

# Auto-generate JWT_SECRET if not provided
if [ -z "$JWT_SECRET" ]; then
    SECRET_FILE="/app/backend/data/.jwt_secret"
    if [ -f "$SECRET_FILE" ]; then
        export JWT_SECRET=$(cat "$SECRET_FILE")
    else
        export JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
        echo "$JWT_SECRET" > "$SECRET_FILE"
        chmod 600 "$SECRET_FILE"
    fi
fi

# Ensure directories exist
mkdir -p /app/backend/data/auth_sessions \
         /app/backend/uploads/avatars \
         /app/backend/uploads/email-attachments \
         /app/backend/uploads/messages \
         /app/backend/uploads/templates

exec node backend/server.js
```

Key behaviors:
- If `JWT_SECRET` env var is set → use it (customer override)
- If not set but `.jwt_secret` file exists in data volume → read it (persistence across restarts)
- If neither → generate random 64-char hex, save to data volume
- `exec` ensures Node.js is PID 1 and receives signals properly

### 3. `.github/workflows/docker-publish.yml` (New)

```yaml
name: Build and Publish Docker Image

on:
  push:
    branches: [main]
    paths-ignore:
      - '*.md'
      - 'docs/**'

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/metadata-action@v5
        id: meta
        with:
          images: ghcr.io/1onegroup/wapnix
          tags: |
            type=raw,value=latest
            type=sha,prefix=sha-

      - uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

concurrency:
  group: docker-publish
  cancel-in-progress: true
```

Uses `GITHUB_TOKEN` (automatic) — no secrets to configure. GitHub Actions cache for fast rebuilds. Concurrency group ensures rapid pushes don't race to publish `:latest`. OCI labels added for image traceability.

### 4. `docker-compose.yml` (Update)

```yaml
services:
  wapnix:
    image: ghcr.io/1onegroup/wapnix:${IMAGE_TAG:-latest}
    container_name: wapnix
    restart: unless-stopped
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - PORT=4000
    volumes:
      - wapnix-data:/app/backend/data
      - wapnix-uploads:/app/backend/uploads

volumes:
  wapnix-data:
  wapnix-uploads:
```

Changes:
- `image:` replaces `build: .`
- `JWT_SECRET` removed (auto-generated)

### 5. `docker-compose.build.yml` (New)

```yaml
services:
  wapnix:
    build: .
    image: wapnix:local
```

Usage: `docker compose -f docker-compose.yml -f docker-compose.build.yml up --build`

**Note:** Uses `wapnix:local` tag (not the GHCR tag) to avoid confusing the local build with the remote image. After testing, switch back to the base `docker-compose.yml` to pull from GHCR.

## What Does NOT Change

- No backend or frontend source code changes
- No changes to `backend/config.js`
- No new ports or services on Hostinger VPS
- No SSL/Traefik/Nginx configuration
- No domain configuration
- `.dockerignore` stays the same

## Deployment Workflows

### Your Hostinger VPS (ongoing deploys)

```bash
# After pushing code to main, GitHub Actions builds the image.
# On Hostinger:
docker compose pull
docker compose up -d
```

Or use Hostinger Docker Manager's "Compose from URL" feature pointing to the repo.

### Customer Self-Hosting

```bash
# 1. Create a docker-compose.yml (or download from repo)
# 2. Run:
docker compose up -d

# That's it. App available at http://<server-ip>:4000
# JWT_SECRET auto-generated, data persisted in volumes.
```

### Rollback

```bash
# Roll back to a specific build (no file edits needed):
IMAGE_TAG=sha-abc1234 docker compose up -d

# Or edit docker-compose.yml: change image tag from :latest to :sha-<commit>
```

To support env-based rollback, the compose file uses: `image: ghcr.io/1onegroup/wapnix:${IMAGE_TAG:-latest}`

## Important Warnings

- **Never run `docker compose down -v`** — the `-v` flag deletes volumes, destroying the SQLite database and all WhatsApp session data permanently.
- **Backup:** `docker cp wapnix:/app/backend/data/app.db ./backup.db` to back up the database.
- **Bind mounts:** If customers use bind mounts instead of named volumes (e.g., `./data:/app/backend/data`), they must ensure correct ownership: `chown -R 1000:1000 ./data ./uploads`

## Testing Plan

1. Build image locally: `docker compose -f docker-compose.yml -f docker-compose.build.yml up --build`
2. Verify app starts, QR scan works, messages send
3. Verify JWT_SECRET auto-generates and persists across `docker compose down && docker compose up -d`
4. Push to main, verify GitHub Actions builds and publishes successfully
5. On Hostinger: `docker compose pull && docker compose up -d` — verify no conflicts with existing services
