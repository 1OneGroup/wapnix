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
