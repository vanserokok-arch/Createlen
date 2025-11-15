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

Createlen supports asynchronous landing page generation through a worker queue system. This enables long-running generations without blocking the API.

### Architecture

- **Web Service**: Handles API requests and queues async tasks
- **Worker Service**: Processes generation tasks from Redis queue
- **Storage**: Results stored in Postgres and artifacts in S3
- **Queue**: BullMQ with Redis (Upstash)

### Synchronous Generation (default)

```bash
curl -X POST http://localhost:3000/generate \
  -H "Content-Type: application/json" \
  -d '{
    "brief": "Юридические услуги для стартапов",
    "page_type": "invest",
    "sessionId": "session-123"
  }'
```

Returns the generated JSON immediately.

### Asynchronous Generation

```bash
curl -X POST http://localhost:3000/generate \
  -H "Content-Type: application/json" \
  -d '{
    "brief": "Юридические услуги для стартапов", 
    "page_type": "invest",
    "async": true,
    "sessionId": "session-123"
  }'
```

Returns immediately with:
```json
{
  "sessionId": "session-123",
  "status": "pending"
}
```

Check status:
```bash
curl http://localhost:3000/status/session-123
```

### API Key Compatibility

The service supports both `OPENAI_KEY` and `OPENAI_API_KEY` environment variables:

```javascript
const OPENAI_KEY = process.env.OPENAI_KEY || process.env.OPENAI_API_KEY;
```

This ensures backward compatibility with existing configurations.

### Environment Variables

Required for autonomous mode:
- `OPENAI_KEY` or `OPENAI_API_KEY` - OpenAI API key
- `DATABASE_URL` - Postgres connection string (Supabase)
- `REDIS_URL` - Redis connection string (Upstash)
- `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION` - AWS S3 credentials

Optional:
- `ALLOWED_TOKEN` - API authentication token

See `docs/DEPLOY_RENDER.md` for detailed deployment instructions.

## Notes
- Do not expose `OPENAI_API_KEY` on the client. All calls must go through the server.
- See `README_Version4.md` for detailed documentation.
