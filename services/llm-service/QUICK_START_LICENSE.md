# Quick Start: License System

## Setup

1. **Install dependencies:**
   ```bash
   cd services/llm-service
   pip install -r requirements.txt
   ```

2. **Start the server:**
   ```bash
   python -m uvicorn app.main:app --reload
   ```

3. **Database is auto-created** on first startup at `data/licenses.db`

## Generate License Key (When User Pays)

```bash
python generate_license.py user@example.com 365
```

This prints:
- License key to send to user
- API call to create license in database

Or create directly via API:
```bash
curl -X POST http://localhost:8000/api/v1/license/create \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "license_key": "user-example-com-20251231-A1B2C3D4",
    "days": 365
  }'
```

## Test the System

1. **Create a test license:**
   ```bash
   curl -X POST http://localhost:8000/api/v1/license/create \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "license_key": "test-example-com-20251231-TEST1234",
       "days": 365
     }'
   ```

2. **Activate license (simulate extension):**
   ```bash
   curl -X POST http://localhost:8000/api/v1/license/activate \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "installation_id": "TEST-DEVICE-123",
       "license_key": "test-example-com-20251231-TEST1234"
     }'
   ```

3. **Validate installation:**
   ```bash
   curl "http://localhost:8000/api/v1/license/validate?email=test@example.com&installation_id=TEST-DEVICE-123"
   ```

4. **Check installations:**
   ```bash
   curl "http://localhost:8000/api/v1/license/installations/test@example.com"
   ```

## API Endpoints Summary

- `POST /api/v1/license/activate` - Activate license for installation
- `GET /api/v1/license/validate` - Validate installation (query params)
- `POST /api/v1/license/validate` - Validate installation (JSON body)
- `POST /api/v1/license/create` - Create license (admin)
- `GET /api/v1/license/installations/{email}` - Get installations (admin)

See `LICENSE_SYSTEM.md` for full documentation.
