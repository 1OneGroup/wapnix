#!/bin/bash
# Wapnix Deployment Script for Hostinger VPS
# Run this on the server after uploading the tar.gz

set -e

echo "=== Wapnix Deployment ==="

# Extract
cd /home/wapnix
if [ -f whatsapp-business-plan.tar.gz ]; then
  echo "[1/6] Extracting files..."
  tar -xzf whatsapp-business-plan.tar.gz
else
  echo "ERROR: whatsapp-business-plan.tar.gz not found in /home/wapnix/"
  exit 1
fi

cd whatsapp-business-plan

# Install backend dependencies
echo "[2/6] Installing backend dependencies..."
cd backend
npm install --production
cd ..

# Install frontend dependencies & build
echo "[3/6] Installing frontend & building..."
cd frontend
npm install
npm run build
cd ..

# Create data directory
echo "[4/6] Setting up data directory..."
mkdir -p backend/data
mkdir -p backend/uploads/avatars
mkdir -p backend/uploads/email-attachments

# Create PM2 ecosystem file
echo "[5/6] Creating PM2 config..."
cat > ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [{
    name: 'wapnix',
    script: 'backend/server.js',
    cwd: '/home/wapnix/whatsapp-business-plan',
    env: {
      NODE_ENV: 'production',
      PORT: 4000,
    },
    max_memory_restart: '500M',
    autorestart: true,
    watch: false,
  }]
};
EOF

# Start with PM2
echo "[6/6] Starting server with PM2..."
pm2 delete wapnix 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

echo ""
echo "=== Deployment Complete! ==="
echo "Server running on port 4000"
echo ""
echo "Next steps:"
echo "1. Setup Nginx reverse proxy (if not done)"
echo "2. Point your domain to this server"
echo ""
