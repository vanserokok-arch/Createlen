# Createlen (keis-replit-generator)

Small Express service that generates and packages simple projects. This PR adds an optional server-side integration to call OpenAI safely.

## Quickstart

1. Install dependencies:
   ```bash
   npm ci
   ```

2. Create `.env` from `.env.example` and add `OPENAI_API_KEY` or `OPENAI_KEY` if you want to enable OpenAI features.

3. Run locally:
   ```bash
   npm run dev
   ```

4. Build and run (container): use Dockerfile or deploy to Render (set `OPENAI_API_KEY` in Render Environment)

## API

### POST /api/generate
- **body**: `{ prompt: string, model?: string }`
- **returns**: `{ text }`

### Legacy endpoints
The server maintains backward compatibility with existing `/generate` and `/export` endpoints.

## Autonomous Mode

Createlen supports asynchronous landing generation via a queue-based worker system. This allows for non-blocking generation of landing pages.

### Architecture

- **Web Service**: Handles API requests
- **Worker Service**: Processes generation tasks from queue
- **Database**: Postgres (Supabase) stores session data
- **Queue**: Redis (Upstash) with BullMQ for task management
- **Storage**: AWS S3 for generated artifacts

### Environment Variables

The service supports both `OPENAI_KEY` and `OPENAI_API_KEY` for compatibility:

```bash
# The service will use OPENAI_KEY if available, otherwise falls back to OPENAI_API_KEY
OPENAI_KEY=sk-...           # Preferred
OPENAI_API_KEY=sk-...       # Fallback for compatibility

# In code:
const apiKey = process.env.OPENAI_KEY || process.env.OPENAI_API_KEY;
```

See `.env.example` for full list of required variables.

### Usage Examples

#### Synchronous Generation (Default)

Request is processed immediately and returns result:

```bash
curl -X POST http://localhost:3000/generate \
  -H "Content-Type: application/json" \
  -d '{
    "token": "your-token",
    "brief": "Услуги по регистрации ООО в Москве",
    "page_type": "invest",
    "sessionId": "session-123"
  }'
```

Response:
```json
{
  "hero": {
    "title": "Регистрация ООО в Москве",
    "subtitle": "Быстро и профессионально",
    "cta": "Получить консультацию"
  },
  "benefits": [...],
  "process": [...],
  "faq": [...]
}
```

#### Asynchronous Generation

Request is queued and returns sessionId immediately:

```bash
curl -X POST http://localhost:3000/generate \
  -H "Content-Type: application/json" \
  -d '{
    "token": "your-token",
    "brief": "Услуги по регистрации ООО в Москве",
    "page_type": "invest",
    "sessionId": "session-456",
    "async": true
  }'
```

Response:
```json
{
  "sessionId": "session-456",
  "status": "pending",
  "message": "Generation queued"
}
```

#### Check Session Status

```bash
curl http://localhost:3000/api/session/session-456?token=your-token
```

Response (pending):
```json
{
  "sessionId": "session-456",
  "status": "pending",
  "created_at": "2024-01-15T10:30:00Z"
}
```

Response (completed):
```json
{
  "sessionId": "session-456",
  "status": "completed",
  "artifact_url": "https://bucket.s3.region.amazonaws.com/landings/session-456/landing.json",
  "payload": { "hero": {...}, "benefits": [...] },
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:45Z"
}
```

### Running Worker

Start the worker to process queued tasks:

```bash
npm run worker
```

The worker will:
1. Connect to Redis queue
2. Process generation tasks
3. Call OpenAI API
4. Upload results to S3
5. Update session status in database

### Deployment

See [docs/DEPLOY_RENDER.md](docs/DEPLOY_RENDER.md) for detailed deployment instructions to Render with Supabase, Upstash, and AWS S3.

## Notes
- Do not expose `OPENAI_API_KEY` on the client. All calls must go through the server.
- Use `async=true` for long-running generations to avoid request timeouts
- Session data is stored in Postgres and can be queried by sessionId
- Generated artifacts (HTML, JSON) are stored in S3 for retrieval
- See `README_Version4.md` for detailed documentation.
