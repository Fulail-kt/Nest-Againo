#!/bin/sh
set -e

if [ -z "${DATABASE_URL:-}" ] && [ -z "${DATABASE_PRIVATE_URL:-}" ]; then
  echo "DATABASE_URL is empty."
  echo "Railway: Nest-Againo → Variables → click {} → pick the Postgres service DATABASE_URL (or DATABASE_PRIVATE_URL)."
  echo "Then click the checkmark to save. Service name in \${{Name.VAR}} must match the left-sidebar name exactly."
  exit 1
fi

echo "Running prisma migrate deploy..."
pnpm exec prisma migrate deploy
echo "Starting Nest on port ${PORT:-3000}..."
exec node dist/src/main.js
