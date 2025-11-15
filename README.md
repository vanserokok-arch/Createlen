# Createlen (keis-replit-generator)

Small Express service that generates and packages simple projects. This PR adds an optional server-side integration to call OpenAI safely.

## Quickstart

1. Install dependencies:
   ```bash
   npm ci
   ```

2. Create `.env` from `.env.example` and add `OPENAI_API_KEY` if you want to enable OpenAI features.

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

The service supports both synchronous and asynchronous landing page generation modes.

### Environment Variables

The service uses the following environment variable names for OpenAI API key (for compatibility):
- `OPENAI_KEY` (primary)
- `OPENAI_API_KEY` (fallback)

The application will use `process.env.OPENAI_KEY || process.env.OPENAI_API_KEY`.

### Synchronous Generation (Default)

Generates landing page immediately and returns the result:

```bash
curl -X POST http://localhost:3000/generate \
  -H "Content-Type: application/json" \
  -d '{
    "brief": "Юридическая помощь по банкротству физических лиц",
    "page_type": "invest",
    "sessionId": "session-123",
    "token": "your-token"
  }'
```

**Response:**
```json
{
  "hero": {"title": "...", "subtitle": "...", "cta": "..."},
  "benefits": [{"title": "...", "text": "..."}],
  "process": [{"step_title": "...", "step_text": "..."}],
  "faq": [{"q": "...", "a": "..."}],
  "seo": {"title": "...", "description": "..."}
}
```

### Asynchronous Generation

For longer processing times, use async mode by adding `"async": true` to the request:

```bash
curl -X POST http://localhost:3000/generate \
  -H "Content-Type: application/json" \
  -d '{
    "brief": "Юридическая помощь по банкротству физических лиц",
    "page_type": "invest",
    "sessionId": "session-456",
    "token": "your-token",
    "async": true
  }'
```

**Response:**
```json
{
  "sessionId": "session-456",
  "status": "queued",
  "message": "Job queued for processing"
}
```

### Check Generation Status

Query the session status:

```bash
curl http://localhost:3000/api/sessions/session-456?token=your-token
```

**Response (processing):**
```json
{
  "session_id": "session-456",
  "status": "processing",
  "created_at": "2025-11-15T14:00:00Z",
  "updated_at": "2025-11-15T14:00:10Z"
}
```

**Response (completed):**
```json
{
  "session_id": "session-456",
  "status": "completed",
  "payload": {
    "result": { /* generated landing data */ },
    "s3_url": "https://bucket.s3.amazonaws.com/landings/session-456/landing.json"
  },
  "created_at": "2025-11-15T14:00:00Z",
  "updated_at": "2025-11-15T14:00:30Z"
}
```

### Flow Overview

**Synchronous Flow:**
1. Client sends POST /generate
2. Server immediately generates landing page using OpenAI
3. Result is stored in-memory and returned
4. Client can call /export to download ZIP

**Asynchronous Flow:**
1. Client sends POST /generate with `async: true`
2. Server creates session in PostgreSQL
3. Job is queued in Redis (BullMQ)
4. Server returns sessionId immediately
5. Worker picks up job from queue
6. Worker generates landing page using OpenAI
7. Result is uploaded to S3
8. Session is updated with completion status
9. Client polls /api/sessions/:sessionId to check status
10. When complete, client can download from S3 URL

### Infrastructure Requirements for Async Mode

- **PostgreSQL** (Supabase): Session tracking
- **Redis** (Upstash): Task queue
- **S3** (AWS): File storage
- **Worker**: Background processor

See [docs/DEPLOY_RENDER.md](docs/DEPLOY_RENDER.md) for deployment instructions.

## Notes
- Do not expose `OPENAI_API_KEY` on the client. All calls must go through the server.
- See `README_Version4.md` for detailed documentation.
