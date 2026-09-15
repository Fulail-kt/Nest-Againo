# Deploy Nest API to Railway (Docker)

Monorepo: set **Root Directory** to `Nest` in Railway.

## 1. Push code

```bash
git add Nest/Dockerfile Nest/.dockerignore Nest/docker-entrypoint.sh Nest/railway.toml
git commit -m "Add Railway Docker deploy"
git push
```

## 2. Create Railway project

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Pick `nest-pro`
3. Service → **Settings** → **Root Directory** = `Nest`
4. **Settings** → **Build** should detect `Dockerfile` (or `railway.toml`)

## 3. Add Postgres

1. Project → **+ New** → **Database** → **PostgreSQL**
2. Open Postgres service → **Connect** → copy `DATABASE_URL` (private network URL is fine)

## 4. Link DB to API service

API service → **Variables**:

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | Click `{}` → pick Postgres `DATABASE_PRIVATE_URL` (or `DATABASE_URL`). Must save with checkmark. Sidebar name must match (`Postgres` vs `PostgreSQL`). |
| `JWT_SECRET` | long random string (32+ chars) |
| `PORT` | Railway sets this automatically — do not hardcode |
| `PUBLIC_API_URL` | `https://YOUR-SERVICE.up.railway.app` (after first deploy, copy from **Settings → Networking → Public URL**) |
| `KEEP_ALIVE` | `true` (test only — remove later) |
| `META_APP_ID` | from Meta |
| `META_APP_SECRET` | from Meta |
| `META_CONFIG_ID` | from Meta |
| `META_GRAPH_API_VERSION` | `v21.0` |
| `META_WEBHOOK_VERIFY_TOKEN` | your verify token |
| `CLOUDINARY_CLOUD_NAME` | optional, for client photos |
| `CLOUDINARY_API_KEY` | optional |
| `CLOUDINARY_API_SECRET` | optional |

Redeploy after setting `PUBLIC_API_URL`.

## 5. Public URL

API service → **Settings** → **Networking** → **Generate Domain**

Copy URL → set `PUBLIC_API_URL` → redeploy.

Health check: `GET https://YOUR-SERVICE.up.railway.app/health` → `{"ok":true}`

## 6. Migrations

`docker-entrypoint.sh` runs `prisma migrate deploy` on every container start.

## 7. Native app (Expo)

Set API URL when building or in `.env`:

```
EXPO_PUBLIC_API_URL=https://YOUR-SERVICE.up.railway.app
```

## 8. WhatsApp webhook

Meta App → Webhook URL:

```
https://YOUR-SERVICE.up.railway.app/webhooks/meta/whatsapp
```

Use same `META_WEBHOOK_VERIFY_TOKEN` as Railway env.

## 9. Keep-alive (temporary)

With `KEEP_ALIVE=true`, app pings `PUBLIC_API_URL/health` every 10 minutes.

Remove when you move to always-on hosting: delete `KEEP_ALIVE` var and remove `KeepAliveService` later.

Alternative: [cron-job.org](https://cron-job.org) → GET `/health` every 10 min (no app code).

## 10. Logs / debug

Railway → API service → **Deployments** → **View logs**

Common fixes:

- **Build fail** — check Docker build logs; run `docker build -t nest-pro .` locally in `Nest/`
- **Crash on start** — `DATABASE_URL` wrong or Postgres not linked
- **502** — wait for health check; confirm `0.0.0.0` bind (already in `main.ts`)

## Local Docker test

```bash
cd Nest
docker build -t nest-pro-api .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL="postgresql://postgres:admin@host.docker.internal:5433/nestpro?schema=public" \
  -e JWT_SECRET="local-test-secret-32-characters-min" \
  nest-pro-api
```

On Windows Docker Desktop, `host.docker.internal` reaches localhost Postgres from `docker-compose.yml`.
