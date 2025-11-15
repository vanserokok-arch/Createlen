# Createlen (keis-replit-generator)

Small Express service that generates and packages simple projects. This PR adds an optional server-side integration to call OpenAI safely.

## Quickstart

1. Install dependencies:
   ```bash
   npm ci
   ```

2. Create `.env` from `.env.example` and add `OPENAI_API_KEY` (or `OPENAI_KEY`) if you want to enable OpenAI features.

3. Run locally:
   ```bash
   npm run dev
   ```

4. Build and run (container): use Dockerfile or deploy to Render (set `OPENAI_API_KEY` or `OPENAI_KEY` in Render Environment)

## API

### POST /api/generate
- **body**: `{ prompt: string, model?: string }`
- **returns**: `{ text }`

### Legacy endpoints
The server maintains backward compatibility with existing `/generate` and `/export` endpoints.

## Autonomous Mode

Createlen supports asynchronous landing generation through a queue-based system. This allows long-running generation tasks to be processed in the background by dedicated workers.

### Architecture

- **Web Service**: Handles API requests and queues jobs
- **Worker Service**: Processes jobs from Redis queue using BullMQ
- **PostgreSQL**: Stores session data and job status
- **Redis (Upstash)**: Message queue for async job processing
- **S3**: Stores generated artifacts (HTML, JSON)

### Environment Variables

The system supports **both** `OPENAI_KEY` and `OPENAI_API_KEY` for OpenAI API authentication (for backward compatibility).

See `.env.example` for full list of required variables.

### Usage Examples

#### Synchronous Generation (immediate response)

```bash
curl -X POST https://your-service.onrender.com/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ALLOWED_TOKEN" \
  -d '{
    "brief": "Создать сайт для юридической компании по банкротству",
    "page_type": "invest",
    "sessionId": "session-123"
  }'
```

Response:
```json
{
  "hero": {
    "title": "Банкротство физических лиц",
    "subtitle": "Поможем списать долги законно",
    "cta": "Получить консультацию"
  },
  "benefits": [...],
  "faq": [...]
}
```

#### Asynchronous Generation (queued)

Submit a job:
```bash
curl -X POST https://your-service.onrender.com/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ALLOWED_TOKEN" \
  -d '{
    "brief": "Создать сайт для юридической компании по банкротству",
    "page_type": "invest",
    "sessionId": "session-456",
    "async": true
  }'
```

Response:
```json
{
  "sessionId": "session-456",
  "status": "queued",
  "message": "Job queued for processing. Use /status endpoint to check progress."
}
```

Check job status:
```bash
curl -X GET "https://your-service.onrender.com/status?sessionId=session-456&token=YOUR_ALLOWED_TOKEN"
```

Response (while processing):
```json
{
  "sessionId": "session-456",
  "status": "processing",
  "payload": {...},
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:15.000Z",
  "jobStatus": {
    "state": "active",
    "progress": 60
  }
}
```

Response (completed):
```json
{
  "sessionId": "session-456",
  "status": "completed",
  "payload": {
    "data": {...},
    "urls": {
      "json": "https://s3.amazonaws.com/...",
      "html": "https://s3.amazonaws.com/..."
    }
  },
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:45.000Z",
  "jobStatus": {
    "state": "completed",
    "progress": 100
  }
}
```

### Flow Overview

1. **Client** sends POST request to `/generate` with `async: true`
2. **Web Service** creates session in PostgreSQL and adds job to Redis queue
3. **Worker** picks up job from queue
4. **Worker** calls OpenAI API to generate landing content
5. **Worker** uploads JSON and HTML to S3
6. **Worker** updates session in PostgreSQL with presigned URLs
7. **Client** polls `/status` endpoint to check progress
8. **Client** downloads artifacts from S3 using presigned URLs

### Deployment

See [docs/DEPLOY_RENDER.md](docs/DEPLOY_RENDER.md) for detailed deployment instructions on Render.

### OPENAI_KEY Compatibility

The system supports both environment variables for backward compatibility:
- `OPENAI_KEY` (primary, recommended)
- `OPENAI_API_KEY` (fallback)

Either one will work. If both are set, `OPENAI_KEY` takes precedence.

## Notes
- Do not expose `OPENAI_API_KEY` or `OPENAI_KEY` on the client. All calls must go through the server.
- See `README_Version4.md` for detailed documentation.
