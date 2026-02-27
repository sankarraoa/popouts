# Database Service

Central database service for licenses and installations. Supports SQLite (local) and PostgreSQL (Railway).

## Local Development (SQLite)

```bash
# Create venv and install
python3 -m venv venv
source venv/bin/activate  # or: . venv/bin/activate
pip install -r requirements.txt

# Run (uses SQLite by default)
uvicorn app.main:app --reload --port 8002
```

Service runs at http://localhost:8002

## PostgreSQL (Railway)

### 1. Configure .env

Set `DATABASE_URL` in `.env`:

```env
DATABASE_URL=postgresql://user:pass@shortline.proxy.rlwy.net:27253/railway
```

Railway provides `DATABASE_URL` when you add a PostgreSQL plugin. Use the public URL for local dev, or the private URL (`postgres.railway.internal`) when deploying on Railway.

### 2. Tables

Tables are created automatically when the app starts (`init_database()`). No manual setup needed.

To create tables manually (e.g. before first deploy):

```bash
DATABASE_URL=postgresql://user:pass@host:port/db python scripts/init_postgres.py
```

Or run the raw SQL in Railway's PostgreSQL query console:

```bash
# See scripts/postgres_schema.sql
```

### 3. Clear PostgreSQL (before fresh migration)

To wipe all data and re-migrate:

```bash
cd services/database-service
python scripts/clear_postgres.py
```

### 4. Add input_hash column (for deduplication)

If you have an existing `extract_action_items` table, run the migration to add `input_hash`:

```bash
cd services/database-service

# PostgreSQL (uses DATABASE_URL from .env):
python scripts/add_input_hash_column.py

# SQLite:
python scripts/add_input_hash_column.py --sqlite ../db-data/licenses.db
```

### 5. Migrate existing data

If you have data in SQLite (`services/db-data/licenses.db`):

```bash
cd services/database-service
DATABASE_URL=postgresql://user:pass@host:port/db python scripts/migrate_to_postgres.py
```

This migrates: licenses, installations, extract_action_items. To also migrate api_requests:

```bash
MIGRATE_API_REQUESTS=1 DATABASE_URL=postgresql://... python scripts/migrate_to_postgres.py
```

## Migrate Data from License Service

If you have existing license data in the license-service SQLite:

**When using Docker** (database-service reads from `services/db-data`):
```bash
cd services/database-service
DB_TARGET=../db-data/licenses.db python scripts/migrate_license_to_db_service.py
```

**When running locally** (uvicorn):
```bash
python scripts/migrate_license_to_db_service.py
```

Environment variables (optional):
- `LICENSE_SOURCE_DB` - Path to license-service SQLite (default: `../data/licenses.db`)
- `DB_TARGET` - Path to database-service SQLite (default: `../db-data/licenses.db` for Docker)

### Migrate to PostgreSQL

```bash
DATABASE_URL=postgresql://user:pass@shortline.proxy.rlwy.net:27253/railway python scripts/migrate_to_postgres.py
```

## API Endpoints

- `GET /api/v1/db/license/by-key?license_key=...` - Get license by key
- `GET /api/v1/db/license/by-email?email=...` - Get license by email
- `GET /api/v1/db/license/list` - List all licenses
- `POST /api/v1/db/license` - Create license
- `DELETE /api/v1/db/license/{id}` - Delete license
- `GET /api/v1/db/installations?email=...` - List installations
- `GET /api/v1/db/installations?email=...&installation_id=...` - Get single installation
- `POST /api/v1/db/installations` - Insert installation
- `POST /api/v1/db/installations/replace-oldest` - Replace oldest installation
- `PATCH /api/v1/db/installations/last-seen?email=...&installation_id=...` - Update last_seen
