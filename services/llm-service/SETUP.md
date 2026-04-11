# LLM Action Extraction Service

Extracts action items from meeting notes using an LLM provider (OpenAI or Toqan).

## Running

### All backend services at once (no Docker)

From `services/`:

```bash
cp llm-service/.env.example llm-service/.env
# Edit llm-service/.env and set OPENAI_API_KEY.
./run-local.sh
```

This starts **database-service** (8002), **license-service** (8001), and **llm-service** (8000). Logs: `services/.local-service-logs/`. Stop with Ctrl+C.

### Docker (from `services/`)

```bash
docker compose up --build
```

This starts the LLM service on **http://localhost:8000** (with DB and license per `docker-compose.yml`).

### LLM service only (manual venv)

```bash
cd services/llm-service
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Configuration

Create `services/llm-service/.env` (see `.env.example`). **Default provider is Toqan:**

```
LLM_PROVIDER=toqan
TOQAN_API_KEY=your_key_here
```

To use OpenAI instead:

```
LLM_PROVIDER=openai
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4
```

## Endpoints

- `POST /api/v1/extract-actions` — Extract action items from meeting notes
- `POST /api/v1/summarize-interview` — Interview summary (overview, pros, cons) from `meeting_details`
- `GET  /api/v1/health` — Health check
- `GET  /test` — Test page
