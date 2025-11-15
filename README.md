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

Createlen now supports asynchronous landing page generation with job queuing, persistent storage, and S3 artifact hosting.

### Architecture

- **Web Service**: Express API that accepts generation requests
- **Background Worker**: BullMQ worker that processes jobs asynchronously
- **Queue**: Redis (Upstash) for job management
- **Database**: PostgreSQL (Supabase) for session tracking
- **Storage**: AWS S3 for generated artifacts

### Flow

1. Client submits generation request with `async: true`
2. Server creates session record in database
3. Job is added to Redis queue
4. Worker picks up job and generates landing
5. Result is uploaded to S3
6. Session is updated with S3 URL
7. Client polls for status and downloads result

### Async Generation Example

```bash
# Step 1: Submit async generation request
curl -X POST https://your-service.onrender.com/generate \
  -H "Content-Type: application/json" \
  -d '{
    "brief": "Юридические услуги по банкротству физических лиц",
    "page_type": "invest",
    "token": "YOUR_ALLOWED_TOKEN",
    "async": true,
    "sessionId": "unique-session-id-123"
  }'

# Response: {"sessionId":"unique-session-id-123","status":"pending"}

# Step 2: Check generation status
curl https://your-service.onrender.com/status/unique-session-id-123?token=YOUR_ALLOWED_TOKEN

# Response (pending):
# {"sessionId":"unique-session-id-123","status":"processing"}

# Response (completed):
# {
#   "sessionId": "unique-session-id-123",
#   "status": "completed",
#   "resultUrl": "https://s3.amazonaws.com/your-bucket/results/unique-session-id-123/landing.json?..."
# }

# Step 3: Download result
curl -O https://s3.amazonaws.com/your-bucket/results/unique-session-id-123/landing.json?...
```

### Synchronous Mode (Legacy)

Synchronous generation still works without the `async` parameter:

```bash
curl -X POST https://your-service.onrender.com/generate \
  -H "Content-Type: application/json" \
  -d '{
    "brief": "Юридические услуги",
    "token": "YOUR_ALLOWED_TOKEN"
  }'
```

### Environment Variables

For autonomous mode, configure these additional variables:

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Redis Queue
REDIS_URL=rediss://default:pass@host:6379

# AWS S3
S3_BUCKET=your-bucket-name
S3_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
S3_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLE
S3_REGION=us-east-1
```

See [docs/DEPLOY_RENDER.md](docs/DEPLOY_RENDER.md) for detailed deployment instructions.

## Notes
- Do not expose `OPENAI_API_KEY` on the client. All calls must go through the server.
- See `README_Version4.md` for detailed documentation.
