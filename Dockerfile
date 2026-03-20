# ============================================
# Stage 1: Build Frontend
# ============================================
FROM node:18-slim AS frontend-build

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ============================================
# Stage 2: Install Backend Dependencies
# ============================================
FROM node:18-slim AS backend-deps

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# ============================================
# Stage 3: Production Image
# ============================================
FROM node:18-slim AS production

WORKDIR /app

# Copy backend source
COPY backend/ ./backend/

# Overwrite node_modules with production-only build from Stage 2
COPY --from=backend-deps /app/backend/node_modules ./backend/node_modules

# Copy built frontend dist
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Create data and uploads directories
RUN mkdir -p /app/backend/data/auth_sessions \
    /app/backend/uploads/avatars \
    /app/backend/uploads/email-attachments

# Non-root user for security
RUN groupadd -r wapnix && useradd -r -g wapnix -d /app wapnix \
    && chown -R wapnix:wapnix /app
USER wapnix

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "fetch('http://localhost:4000/api/health').then(r=>{if(!r.ok)throw 1}).catch(()=>process.exit(1))"

CMD ["node", "backend/server.js"]
