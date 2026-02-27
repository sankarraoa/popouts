# Database Service Implementation Plan

A phased, atomic plan to create a dedicated database service that supports SQLite (local) and PostgreSQL (Railway), and migrate license data from the license service.

**PostgreSQL URLs:**
- Public: `shortline.proxy.rlwy.net:27253`
- Private (Railway internal): `postgres.railway.internal`

---

## Phase 1: Create Database Service with SQLite

### 1.1 Create service skeleton
- [x] Create `services/database-service/` directory
- [x] Add `requirements.txt` (fastapi, uvicorn, aiosqlite, pydantic, pydantic-settings)
- [x] Add `Dockerfile` (Python 3.11-slim, similar to license-service)
- [x] Add `app/main.py` with FastAPI app, health endpoint, CORS
- [x] Add `app/config.py` with Settings (host, port, db_path)
- [x] Add `app/utils/logger.py` (copy from license-service)
- [x] Add `railway.toml` for build config
- [x] Verify: `uvicorn app.main:app --reload --port 8002` runs

### 1.2 Add database abstraction layer
- [x] Create `app/database.py` with:
  - `get_db_connection()` returning async connection
  - `init_database()` creating tables
  - DB path from env: `DB_PATH` or `/data` or `./data`
- [ ] Use portable schema (no SQLite-specific features):
  - `licenses` table: id, email, license_key, expiry_date, created_at, status
  - `installations` table: id, email, installation_id, activated_at, last_seen
  - Indexes: idx_licenses_email, idx_installations_email, idx_installations_id
- [x] Verify: Tables created on startup, no errors

### 1.3 Add license API endpoints
- [x] Create `app/db/license_repository.py` with:
  - `get_license_by_key(license_key)`
  - `get_license_by_email(email)`
  - `get_installations(email)`
  - `get_installations_by_installation_id(email, installation_id)`
  - `create_license(email, license_key, expiry_date, status)`
  - `delete_license(license_id)`
  - `upsert_installation(email, installation_id)`
  - `update_installation_last_seen(installation_id)`
- [x] Create `app/api/routes.py` with internal endpoints:
  - `GET /api/v1/db/license/by-key?license_key=...` → license row or 404
  - `GET /api/v1/db/license/by-email?email=...` → license row or 404
  - `GET /api/v1/db/installations?email=...` → list of installations
  - `GET /api/v1/db/installations?email=...&installation_id=...` → single
  - `POST /api/v1/db/license` → create license
  - `DELETE /api/v1/db/license/{id}` → delete license
  - `POST /api/v1/db/installations` → upsert installation
  - `PATCH /api/v1/db/installations?email=...&installation_id=...` → update last_seen
- [x] Add `INTERNAL_API_KEY` or similar for service-to-service auth (optional for Phase 1)
- [x] Verify: All endpoints work with SQLite locally

### 1.4 Add data migration script
- [x] Create `scripts/migrate_license_to_db_service.py`:
  - Reads from existing license-service SQLite (`./data/licenses.db` or `LICENSE_DB_PATH`)
  - Connects to database-service (HTTP or direct SQLite if same file)
  - Copies all rows from `licenses` and `installations`
  - Idempotent: can re-run safely (upsert by license_key)
- [x] Document: `python scripts/migrate_license_to_db_service.py`
- [x] Verify: Run migration, compare row counts

**Phase 1 checkpoint:** Database service runs locally with SQLite, has license data, API works.

---

## Phase 2: Migrate License Service to Use Database Service

### 2.1 Add HTTP client in license service
- [x] Add `app/db_client.py` in license-service:
  - `DATABASE_SERVICE_URL` env (default: `http://localhost:8002`)
  - Async HTTP client (httpx or aiohttp)
  - Functions: `get_license_by_key`, `get_license_by_email`, `get_installations`, etc.
- [x] Add `httpx` to license-service requirements

### 2.2 Refactor license_service.py to use DB client
- [x] Replace `get_db_connection()` calls with `db_client.*` calls
- [ ] Keep `activate_license`, `validate_installation`, `create_license`, etc. logic
- [x] Handle HTTP errors (e.g. 404 → invalid_license)
- [x] Verify: License service still works with database service running

### 2.3 Update docker-compose
- [x] Add `database-service` to docker-compose
- [x] Mount `./data` or `./db-data` for database-service SQLite
- [x] Set `DATABASE_SERVICE_URL=http://database-service:8002` for license-service
- [x] Ensure startup order: database-service before license-service (or use depends_on)
- [x] Remove SQLite volume from license-service (or keep for now, but license-service no longer uses it)
- [ ] Verify: `docker-compose up` — both services run, license flows work

### 2.4 Migrate existing data
- [x] Run migration script to copy license-service data to database-service
- [x] Or: Point database-service volume to same `./data` path initially (shared file)
- [x] Verify: All licenses and installations visible via database-service API

**Phase 2 checkpoint:** License service uses database service via HTTP. No direct DB access in license service.

---

## Phase 3: Add PostgreSQL Support to Database Service

### 3.1 Add connection abstraction
- [x] Add `asyncpg` or `sqlalchemy` to requirements.txt
- [ ] Add `DATABASE_URL` env: `sqlite:///./data/licenses.db` or `postgresql://user:pass@host:port/db`
- [ ] Create `app/database/connection.py`:
  - Parse `DATABASE_URL` to detect sqlite vs postgresql
  - `get_db_connection()` returns appropriate connection
- [ ] Use parameterized queries with `?` (SQLite) vs `$1` (PostgreSQL) — handle via library or SQLAlchemy

### 3.2 Use SQLAlchemy for portability (recommended)
- [x] Add `sqlalchemy` and `aiosqlite` / `asyncpg` to requirements
- [x] Define models: `License`, `Installation`
- [x] Use `create_async_engine` with `DATABASE_URL`
- [x] Schema: Same columns, portable types
- [x] Create `app/database/session.py` with async session
- [x] Refactor `license_repository.py` to use SQLAlchemy models
- [x] Verify: Works with SQLite locally

### 3.3 PostgreSQL schema
- [x] Create `app/database/migrations/` or use Alembic for migrations
- [x] For simplicity: Run `CREATE TABLE IF NOT EXISTS` on startup (same as SQLite)
- [x] Adjust: `AUTOINCREMENT` → `SERIAL` or `BIGSERIAL` for PostgreSQL
- [x] Use SQLAlchemy: `Integer` and `autoincrement=True` work for both
- [x] Verify: Database service connects to Railway PostgreSQL with `DATABASE_URL=postgresql://...`

### 3.4 Test with PostgreSQL remotely
- [ ] Set `DATABASE_URL` to Railway PostgreSQL (public URL for local testing)
- [ ] Run database service locally: `DATABASE_URL=postgresql://... uvicorn app.main:app --port 8002`
- [ ] Run migration script to copy SQLite data to PostgreSQL
- [ ] Verify: All endpoints work with PostgreSQL
- [ ] Verify: License service (pointing to database service) works end-to-end

**Phase 3 checkpoint:** Database service supports both SQLite and PostgreSQL via `DATABASE_URL`.

---

## Phase 4: Admin UI Hub and Interfaces

**Goal:** Single entry point (`/admin`) to access all admin UIs. Move license management UI to database service. Add API request/response viewer. Both (and future UIs) accessible from one link.

**Architecture:** All admin UIs live in the database service so one URL (`/admin`) serves as the hub. No cross-origin links; licenses and requests are at `/admin/licenses` and `/admin/requests`. Future UIs (e.g. `/admin/analytics`) follow the same pattern.

### 4.1 Add API request logging to database service
- [ ] Add `api_requests` table to schema:
  - id, timestamp, service (e.g. 'llm'), endpoint, method
  - user_identifier (email/product_key if available)
  - request_body (TEXT/JSON, optionally truncated)
  - response_body (TEXT/JSON, optionally truncated)
  - status_code, duration_ms
- [ ] Add `app/db/api_request_repository.py`: `insert_request()`, `list_requests()`, `get_request(id)`
- [ ] Add API endpoints: `POST /api/v1/db/requests` (for services to log), `GET /api/v1/db/requests` (list with pagination)
- [ ] Verify: Can insert and query api_requests

### 4.2 Add request logging middleware to LLM service
- [ ] Add `DATABASE_SERVICE_URL` to LLM service config
- [ ] Add middleware or dependency that logs each request/response to database service
- [ ] Log: endpoint, method, body (truncate if large, e.g. 2000 chars), status, duration
- [ ] Use async/background task so logging does not block response
- [ ] Verify: LLM requests appear in database service api_requests table

### 4.3 Create admin hub in database service
- [ ] Add `GET /admin` route → serves admin hub HTML (landing page)
- [ ] Hub page: cards/links to:
  - License management → `/admin/licenses`
  - API requests → `/admin/requests`
  - (Future UIs can be added here)
- [ ] Single link for users: `http://localhost:8002/admin` (or production URL)
- [ ] Verify: Visiting /admin shows hub with links

### 4.4 Move license management UI to database service
- [ ] Copy `admin.html` from license-service to database-service
- [ ] Adapt to fetch from database service API (`/api/v1/db/license/*`) instead of `/api/v1/license/*`
- [ ] Add `GET /admin/licenses` → serves license management UI
- [ ] Remove `/admin` and admin UI from license-service (license service becomes API-only)
- [ ] Verify: License management works at database-service/admin/licenses

### 4.5 Build API request viewer UI in database service
- [ ] Create `admin-requests.html` (or similar)
- [ ] Table: timestamp, service, endpoint, user, status, duration, expandable request/response
- [ ] Fetch from `GET /api/v1/db/requests`
- [ ] Add pagination, optional filters (date range, endpoint, status)
- [ ] Add `GET /admin/requests` route → serves this UI
- [ ] Verify: Can view API requests in table at database-service/admin/requests

### 4.6 Configure service URLs for hub links
- [ ] Hub links use relative paths: `/admin/licenses`, `/admin/requests` (all served by database service)
- [ ] No cross-origin links needed if all UIs live in database service
- [ ] Verify: Single link `/admin` → hub → licenses and requests both work

**Phase 4 checkpoint:** One link (`/admin`) opens hub; licenses and API requests UIs work. License service is API-only.

---

## Phase 5: Deploy to Railway

### 5.1 Database service on Railway
- [ ] Create new Railway project or add service
- [ ] Add PostgreSQL plugin (or use existing Railway PostgreSQL)
- [ ] Add `database-service` as a deployable service
- [ ] Set env: `DATABASE_URL` = `postgresql://...` (use private URL `postgres.railway.internal` when available)
- [ ] No volume needed for database-service (PostgreSQL is the store)
- [ ] Add `railway.toml` for database-service
- [ ] Deploy via GitHub
- [ ] Verify: Health check passes, tables created

### 5.2 License service on Railway
- [ ] Set `DATABASE_SERVICE_URL` to database-service URL (Railway internal: `http://database-service.railway.internal:8002` or similar)
- [ ] Remove SQLite volume from license-service (no longer needed)
- [ ] Redeploy license-service
- [ ] Verify: License activate/validate/create works in production

### 5.3 Data migration to production PostgreSQL
- [ ] Export existing production SQLite data (if any) from license-service volume
- [ ] Run migration script to import into Railway PostgreSQL
- [ ] Or: If fresh deploy, no migration needed
- [ ] Verify: Production licenses visible in admin UI

### 5.4 Cleanup
- [ ] Remove `app/database.py` and SQLite code from license-service
- [ ] Remove `aiosqlite` from license-service requirements
- [ ] Remove volume mount from license-service in Railway
- [ ] Update README / docs with new architecture

**Phase 5 checkpoint:** Production runs on PostgreSQL. License service no longer has SQLite.

---

## Summary

| Phase | Focus | Checkpoint |
|-------|-------|------------|
| 1 | Database service + SQLite + license API | Service runs, API works, data migrated |
| 2 | License service uses DB service via HTTP | docker-compose works end-to-end |
| 3 | PostgreSQL support in DB service | Works with both SQLite and PostgreSQL |
| 4 | Admin UI hub + license UI + request viewer | Single link `/admin` for all admin UIs |
| 5 | Deploy to Railway | Production on PostgreSQL |

---

## Atomic Task Checklist (Copy-Paste)

```
Phase 1: Database Service + SQLite
[ ] 1.1 Create service skeleton
[ ] 1.2 Add database abstraction layer
[ ] 1.3 Add license API endpoints
[ ] 1.4 Add data migration script

Phase 2: License Service Migration
[ ] 2.1 Add HTTP client in license service
[ ] 2.2 Refactor license_service.py to use DB client
[ ] 2.3 Update docker-compose
[ ] 2.4 Migrate existing data

Phase 3: PostgreSQL Support
[ ] 3.1 Add connection abstraction
[ ] 3.2 Use SQLAlchemy for portability
[ ] 3.3 PostgreSQL schema
[ ] 3.4 Test with PostgreSQL remotely

Phase 4: Admin UI Hub and Interfaces
[ ] 4.1 Add API request logging to database service
[ ] 4.2 Add request logging middleware to LLM service
[ ] 4.3 Create admin hub in database service
[ ] 4.4 Move license management UI to database service
[ ] 4.5 Build API request viewer UI in database service
[ ] 4.6 Configure service URLs for hub links

Phase 5: Deploy to Railway
[ ] 5.1 Database service on Railway
[ ] 5.2 License service on Railway
[ ] 5.3 Data migration to production PostgreSQL
[ ] 5.4 Cleanup
```
