# Server-Side API

This directory contains server-side code for Popouts, including:

- **LLM Integration**: API endpoints for AI-powered features (action extraction, note summarization, etc.)
- **Backup & Sync**: Endpoints for backing up and syncing data across devices
- **Authentication**: User authentication and authorization (future)

## Structure

```
server/
├── api/
│   ├── llm/              # LLM integration endpoints
│   │   └── extract-actions.js
│   └── backup/           # Backup and sync endpoints
│       └── sync.js
├── config/               # Server configuration
│   └── config.js
├── package.json          # Node.js dependencies
└── server.js             # Main server entry point
```

## Getting Started (Future)

1. Install dependencies:
   ```bash
   cd server
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. Run the server:
   ```bash
   npm start
   ```

## Planned Features

- [ ] LLM integration for automatic action item extraction
- [ ] Note summarization and insights
- [ ] Cloud backup and sync
- [ ] Multi-device synchronization
- [ ] User authentication
