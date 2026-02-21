# Backup & Sync API

API endpoints for backing up and syncing Popouts data across devices.

## Planned Endpoints

### POST /api/backup/upload
Upload meeting data to cloud storage.

**Request:**
```json
{
  "userId": "user-123",
  "data": {
    "meetings": [...],
    "agendaItems": [...],
    "actionItems": [...],
    "notes": [...]
  }
}
```

**Response:**
```json
{
  "success": true,
  "backupId": "backup-456",
  "timestamp": "2026-02-18T10:00:00Z"
}
```

### GET /api/backup/download
Download latest backup for a user.

### POST /api/backup/sync
Sync data between devices (merge strategy).

## Implementation Notes

- Encrypted storage for user data
- Incremental backups (only changed data)
- Conflict resolution for multi-device sync
- Backup retention policy
- GDPR compliance considerations
