#!/bin/sh
set -e
echo "Running prisma migrate deploy..."
pnpm exec prisma migrate deploy
echo "Starting Nest on port ${PORT:-3000}..."
exec node dist/src/main.js
