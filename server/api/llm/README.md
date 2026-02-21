# LLM Integration API

API endpoints for AI-powered features using Large Language Models.

## Planned Endpoints

### POST /api/llm/extract-actions
Extract action items from meeting notes automatically.

**Request:**
```json
{
  "notes": "Meeting notes text...",
  "meetingId": "meeting-123"
}
```

**Response:**
```json
{
  "actions": [
    {
      "text": "Follow up on budget approval",
      "assignee": "John Doe",
      "dueDate": "2026-02-25"
    }
  ]
}
```

### POST /api/llm/summarize
Generate a summary of meeting notes.

### POST /api/llm/suggest-agenda
Suggest agenda items based on previous meetings.

## Implementation Notes

- Will use OpenAI API or similar LLM service
- Rate limiting and cost management required
- Caching for repeated requests
- Error handling for API failures
