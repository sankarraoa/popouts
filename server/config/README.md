# Server Configuration

Configuration files for the Popouts server.

## Files

- `config.js` - Main configuration file
- `.env.example` - Example environment variables template

## Configuration Options

- API keys (OpenAI, etc.)
- Database connection strings
- Server port and host
- CORS settings
- Rate limiting configuration
- Backup storage settings

## Environment Variables

```bash
# LLM API
OPENAI_API_KEY=your_key_here

# Database
DATABASE_URL=postgresql://...

# Server
PORT=3000
NODE_ENV=production

# Backup Storage
BACKUP_STORAGE_TYPE=s3|local
AWS_S3_BUCKET=popouts-backups
```
