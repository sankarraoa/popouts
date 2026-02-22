# License Management System

This document explains how the license management system works and how to use it.

## Overview

The license system manages:
- **30-day free trial** for new users
- **Paid licenses** with expiry dates
- **2-device limit** per license
- **Installation tracking** to prevent abuse

## Database Schema

### Licenses Table
- `id`: Primary key
- `email`: User's email (unique identifier)
- `license_key`: License key string (unique)
- `expiry_date`: Expiry date (ISO format)
- `created_at`: Creation timestamp
- `status`: 'active' or 'expired'

### Installations Table
- `id`: Primary key
- `email`: User's email (foreign key)
- `installation_id`: Unique device/browser ID
- `activated_at`: When installation was activated
- `last_seen`: Last validation timestamp

## API Endpoints

### 1. Activate License
**POST** `/api/v1/license/activate`

Activate a license for a specific installation.

**Request:**
```json
{
  "email": "user@example.com",
  "installation_id": "ABC123-XYZ789",
  "license_key": "user-example-com-20251231-A1B2C3D4"
}
```

**Response:**
```json
{
  "valid": true,
  "expiry": "2025-12-31T00:00:00",
  "active_count": 1,
  "message": "License activated successfully"
}
```

### 2. Validate Installation
**GET** `/api/v1/license/validate?email=X&installation_id=Y`

**POST** `/api/v1/license/validate`

Validate if an installation is still active.

**Request (POST):**
```json
{
  "email": "user@example.com",
  "installation_id": "ABC123-XYZ789"
}
```

**Response:**
```json
{
  "valid": true,
  "expiry": "2025-12-31T00:00:00",
  "message": "Installation validated"
}
```

### 3. Create License (Admin)
**POST** `/api/v1/license/create`

Create a new license when user pays.

**Request:**
```json
{
  "email": "user@example.com",
  "license_key": "user-example-com-20251231-A1B2C3D4",
  "days": 365
}
```

**Response:**
```json
{
  "success": true,
  "email": "user@example.com",
  "license_key": "user-example-com-20251231-A1B2C3D4",
  "expiry": "2025-12-31T00:00:00"
}
```

### 4. Get Installations (Admin)
**GET** `/api/v1/license/installations/{email}`

Get all installations for an email.

**Response:**
```json
{
  "email": "user@example.com",
  "installations": [
    {
      "installation_id": "ABC123-XYZ789",
      "activated_at": "2024-01-15T10:00:00",
      "last_seen": "2024-01-20T15:30:00"
    }
  ],
  "count": 1
}
```

## Workflow

### When User Pays

1. **User provides email** when paying offline
2. **Generate license key**:
   ```bash
   python generate_license.py user@example.com 365
   ```
3. **Create license in database**:
   ```bash
   curl -X POST http://localhost:8000/api/v1/license/create \
     -H "Content-Type: application/json" \
     -d '{
       "email": "user@example.com",
       "license_key": "user-example-com-20251231-A1B2C3D4",
       "days": 365
     }'
   ```
4. **Send license key to user** via email

### When User Activates License

1. User enters license key in extension Settings
2. Extension calls `/api/v1/license/activate`
3. Server validates key and checks installation limit
4. If valid: License activated, extension stores expiry
5. Extension checks `/api/v1/license/validate` daily

### Installation Limit Logic

- **Max 2 installations** per email
- **Same installation_id** = reinstall (always allowed)
- **New installation_id** + < 2 installations = add new
- **New installation_id** + 2 installations = replace oldest

## License Key Format

Format: `EMAIL-EXPIRY-HASH`

Example: `user-example-com-20251231-A1B2C3D4`

- `user-example-com`: Cleaned email (lowercase, special chars replaced)
- `20251231`: Expiry date (YYYYMMDD)
- `A1B2C3D4`: Hash signature (8 chars)

## Database Location

SQLite database is stored at:
```
services/llm-service/data/licenses.db
```

## Testing

### Test License Creation
```bash
curl -X POST http://localhost:8000/api/v1/license/create \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "license_key": "test-example-com-20251231-TEST1234",
    "days": 365
  }'
```

### Test License Activation
```bash
curl -X POST http://localhost:8000/api/v1/license/activate \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "installation_id": "TEST-INSTALL-123",
    "license_key": "test-example-com-20251231-TEST1234"
  }'
```

### Test Installation Validation
```bash
curl "http://localhost:8000/api/v1/license/validate?email=test@example.com&installation_id=TEST-INSTALL-123"
```

## Security Notes

1. **Change secret salt** in `generate_license.py` before production
2. **Validate license keys** server-side (not just client-side)
3. **Rate limit** activation endpoints to prevent abuse
4. **Monitor** installation counts for suspicious activity
5. **Consider** adding authentication for admin endpoints

## Extension Integration

The extension should:
1. Generate `installation_id` on first install (device fingerprint)
2. Check free trial expiry (30 days from install)
3. If expired: Require license key
4. On license activation: Call `/api/v1/license/activate`
5. Store expiry date locally
6. Check `/api/v1/license/validate` daily
7. Block LLM service if license invalid/expired
