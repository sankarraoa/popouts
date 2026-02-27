# Deploy database-service to Railway

## Prerequisites

- Railway account with PostgreSQL already provisioned
- GitHub repo pushed: `https://github.com/sankarraoa/popouts`

---

## Private network (recommended)

Use Railway's private network for faster, free service-to-service traffic:

- **PostgreSQL**: `postgres.railway.internal:5432`
- **database-service**: `database-service.railway.internal:<PORT>`
- **llm-service**: `llm-service.railway.internal:<PORT>`
- **license-service**: `license-service.railway.internal:<PORT>`

---

## Step 1: Deploy database-service

1. In your Railway project, click **New** → **GitHub Repo**
2. Select `sankarraoa/popouts`
3. Configure the service:
   - **Root Directory**: `services/database-service`
   - **Build**: Uses `Dockerfile` (from railway.toml)
   - **Start Command**: (auto from Dockerfile)

4. Add **Variables**:
   | Variable | Value |
   |----------|-------|
   | `DATABASE_URL` | Use **Add Reference** → PostgreSQL → `DATABASE_PRIVATE_URL` (or `postgresql://user:pass@postgres.railway.internal:5432/railway`) |
   | `PORT` | `8002` (optional; keeps internal port predictable) |

5. Deploy (Railway auto-deploys on push, or trigger manually)

---

## Step 2: Configure LLM service and license service

For **llm-service** and **license-service**, add:

| Variable | Value |
|----------|-------|
| `DATABASE_SERVICE_URL` | `http://database-service.railway.internal:8002` |

If database-service uses a different PORT, use that port instead of 8002.

---

## Step 3: Clear and migrate data

From your local machine, with `DATABASE_URL` in `.env` pointing to Railway PostgreSQL:

```bash
cd services/database-service

# 1. Clear existing data (if any)
python scripts/clear_postgres.py

# 2. Migrate from local SQLite to Railway PostgreSQL
# Run from meetingNotes root, or set LICENSE_SOURCE_DB:
cd /path/to/meetingNotes
LICENSE_SOURCE_DB=services/db-data/licenses.db python services/database-service/scripts/migrate_to_postgres.py

# Or from database-service dir:
cd services/database-service
LICENSE_SOURCE_DB=../db-data/licenses.db python scripts/migrate_to_postgres.py

# 3. Add input_hash column (for deduplication)
python scripts/add_input_hash_column.py
```

---

## Step 4: Admin console URL

After deployment, Railway gives you a URL like:

```
https://<service-name>-<project>.up.railway.app
```

**Admin console**: `https://<your-database-service-url>/admin`

Example: `https://database-service-production-xxxx.up.railway.app/admin`

To find it: Railway Dashboard → database-service → Settings → Domains → copy the generated URL.

---

## Step 5: Chrome extension and public URLs

- **Chrome extension**: Point API base URL to your **public** Railway URLs (e.g. `https://llm-service-xxx.up.railway.app`)
- Internal URLs (`*.railway.internal`) are for service-to-service only; browsers cannot reach them

---

## Variable summary

| Service | Variable | Value |
|---------|----------|-------|
| **database-service** | `DATABASE_URL` | `${{Postgres.DATABASE_PRIVATE_URL}}` or `postgresql://user:pass@postgres.railway.internal:5432/railway` |
| **database-service** | `PORT` | `8002` (optional) |
| **llm-service** | `DATABASE_SERVICE_URL` | `http://database-service.railway.internal:8002` or `https://database-service-production-a04d.up.railway.app` |
| **license-service** | `DATABASE_SERVICE_URL` | `http://database-service.railway.internal:8002` or `https://database-service-production-a04d.up.railway.app` |

## Service URLs (example)

| Service | Public URL |
|---------|------------|
| database-service | `https://database-service-production-a04d.up.railway.app` |
| license-service | `https://license-service-production.up.railway.app` |

---

## Quick reference

| Task | Command |
|------|---------|
| Clear PostgreSQL | `python scripts/clear_postgres.py` |
| Migrate SQLite → PostgreSQL | `python scripts/migrate_to_postgres.py` |
| Add input_hash column | `python scripts/add_input_hash_column.py` |
| Admin URL | `https://<database-service-public-url>/admin` |
