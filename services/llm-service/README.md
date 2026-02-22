# LLM Action Extraction Service

Microservice for extracting action items from meeting notes using LLM providers (Toqan or OpenAI).

## Features

- Extract action items from meeting notes
- Support for Toqan and OpenAI providers
- JSON-based API compatible with Toqan format
- Dockerized for easy deployment
- Railway-ready configuration
- Test HTML page for easy testing

## Local Development

### Prerequisites

- Python 3.11+
- Docker and Docker Compose (optional)

### Setup

1. Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

2. Configure your API keys in `.env`:
```env
LLM_PROVIDER=toqan  # or "openai"
TOQAN_API_KEY=your_toqan_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Run locally:
```bash
python -m app.main
```

Or with Docker:
```bash
docker-compose up --build
```

The service will be available at `http://localhost:8000`

## Testing

### Using the Test HTML Page

1. Start the service (see above)
2. Open `test.html` in your browser (double-click or open via file://)
3. The page will:
   - Load sample data automatically
   - Check service health
   - Allow you to edit JSON and test different scenarios
   - Support custom prompts for testing

### API Endpoints

#### POST `/api/v1/extract-actions`

Extract action items from meeting notes.

**Request:**
```json
{
  "meeting_details": {
    "meeting_series": {
      "id": "meeting-123",
      "name": "1:1 with Alex",
      "type": "1:1s"
    },
    "meeting_instance": {
      "id": "instance-456",
      "series_id": "meeting-123",
      "notes": [
        {
          "text": "Discussed Q1 goals and budget approval. Need to follow up on budget by end of week."
        }
      ]
    },
    "agenda_items": [],
    "existing_actions": []
  }
}
```

**Response:**
```json
{
  "series_id": "meeting-123",
  "meeting_id": "instance-456",
  "notes_with_actions": [
    {
      "note": {
        "text": "Discussed Q1 goals and budget approval. Need to follow up on budget by end of week.",
        "created_at": null,
        "updated_at": null
      },
      "action_items": [
        {
          "text": "Follow up on budget approval by end of week"
        }
      ]
    }
  ]
}
```

#### GET `/api/v1/health`

Health check endpoint.

## Railway Deployment

1. Connect your GitHub repository to Railway
2. Set the root directory to `services/llm-service`
3. Add environment variables in Railway dashboard:
   - `LLM_PROVIDER`
   - `TOQAN_API_KEY` (if using Toqan)
   - `OPENAI_API_KEY` (if using OpenAI)
4. Railway will automatically detect the Dockerfile and deploy

## Environment Variables

- `LLM_PROVIDER`: Default provider ("toqan" or "openai")
- `TOQAN_API_KEY`: Toqan API key (starts with `sk_`)
- `OPENAI_API_KEY`: OpenAI API key
- `OPENAI_MODEL`: OpenAI model to use (default: "gpt-4")
- `HOST`: Server host (default: "0.0.0.0")
- `PORT`: Server port (default: 8000)

## Architecture

- **FastAPI**: Modern async web framework
- **Provider Pattern**: Easy to add new LLM providers
- **Pydantic Models**: Type safety and validation
- **Docker**: Consistent deployment across environments

## Notes

- The service automatically selects the LLM provider based on configuration
- Clients don't need to know which provider is being used
- Each note can have 0, 1, or multiple action items
- Action items can be exactly the same as the note or structured/improved versions
