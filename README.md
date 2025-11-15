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

Createlen now supports asynchronous landing page generation using a background worker queue. This is ideal for production deployments with multiple concurrent requests.

### Architecture

- **Web Service**: Express API that accepts generation requests
- **Worker Service**: Background worker that processes generation tasks
- **Queue**: Redis (Upstash) with BullMQ for job management
- **Database**: PostgreSQL (Supabase) for session tracking
- **Storage**: AWS S3 for generated artifacts

### Environment Variables

The system uses `OPENAI_KEY` as the primary environment variable, with fallback to `OPENAI_API_KEY` for compatibility:

```javascript
const apiKey = process.env.OPENAI_KEY || process.env.OPENAI_API_KEY;
```

### Usage

#### Synchronous Generation (existing behavior)

```bash
curl -X POST http://localhost:3000/generate \
  -H "Content-Type: application/json" \
  -d '{
    "token": "your-token",
    "brief": "Юридические услуги для стартапов",
    "page_type": "invest"
  }'
```

Returns generated JSON immediately.

#### Asynchronous Generation (new)

```bash
# 1. Submit generation task
curl -X POST http://localhost:3000/generate \
  -H "Content-Type: application/json" \
  -d '{
    "token": "your-token",
    "brief": "Юридические услуги для стартапов",
    "page_type": "invest",
    "async": true
  }'

# Response:
# {
#   "sessionId": "session-1234567890",
#   "status": "queued",
#   "message": "Generation task enqueued. Use GET /session/:sessionId to check status."
# }

# 2. Check generation status
curl http://localhost:3000/session/session-1234567890

# Response (while processing):
# {
#   "sessionId": "session-1234567890",
#   "status": "processing",
#   "created_at": "2024-01-01T00:00:00.000Z",
#   "updated_at": "2024-01-01T00:00:05.000Z"
# }

# Response (when completed):
# {
#   "sessionId": "session-1234567890",
#   "status": "completed",
#   "artifact_url": "https://bucket.s3.amazonaws.com/sessions/.../landing.html",
#   "payload": {
#     "brief": "...",
#     "htmlUrl": "...",
#     "jsonUrl": "...",
#     "data": { ... }
#   },
#   "created_at": "2024-01-01T00:00:00.000Z",
#   "updated_at": "2024-01-01T00:00:30.000Z"
# }
```

### Flow Diagram

```
Client Request → Web API → Queue (Redis) → Worker → OpenAI API
                    ↓                          ↓
                Database (Postgres)       S3 Storage
                    ↓                          ↓
Client Poll Status ← Session Record ← Update Status
```

### Deployment

See [docs/DEPLOY_RENDER.md](docs/DEPLOY_RENDER.md) for detailed deployment instructions.

Quick setup:
1. Set up Supabase (PostgreSQL), Upstash (Redis), and AWS S3
2. Configure environment variables
3. Deploy web service and worker to Render
4. Run database migration

## Notes
- Do not expose `OPENAI_API_KEY` on the client. All calls must go through the server.
- See `README_Version4.md` for detailed documentation.
- For autonomous mode, ensure `DATABASE_URL`, `REDIS_URL`, and S3 credentials are configured.
