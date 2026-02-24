# LLM Action Extraction Service

Extracts action items from meeting notes using an LLM provider (OpenAI or Toqan).

## Running

All services are started from the `services/` directory:

```bash
cd services
docker-compose up --build
```

This starts the LLM service on **http://localhost:8000**.

### For local development without Docker

```bash
cd services/llm-service
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Configuration

Create `services/llm-service/.env`:

```
LLM_PROVIDER=openai
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4
```

## Endpoints

- `POST /api/v1/extract-actions` — Extract action items from meeting notes
- `GET  /api/v1/health` — Health check
- `GET  /test` — Test page
