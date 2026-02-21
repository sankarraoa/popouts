# Shared Code

Shared types, utilities, and constants used by both the Chrome extension (client) and server-side code.

## Structure

```
shared/
├── types.js          # TypeScript/JS type definitions
├── constants.js      # Shared constants
└── utils.js          # Shared utility functions
```

## Purpose

- **Type Definitions**: Data structures for meetings, agenda items, actions, notes
- **Constants**: Shared enums, status codes, API endpoints
- **Utilities**: Common functions used by both client and server

## Usage

### In Chrome Extension:
```javascript
import { MeetingType, ActionStatus } from '../shared/constants.js';
```

### In Server:
```javascript
const { MeetingType, ActionStatus } = require('../shared/constants.js');
```

## Planned Content

- Meeting data structures
- API request/response types
- Validation schemas
- Common enums (MeetingType, ActionStatus, etc.)
