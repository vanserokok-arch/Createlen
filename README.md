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

The service supports asynchronous landing generation with background workers, queue-based task processing, and artifact storage in S3.

### Architecture

- **Web Service**: Handles API requests and queues generation jobs
- **Worker Service**: Processes jobs asynchronously using BullMQ
- **PostgreSQL**: Stores session state and metadata
- **Redis**: Message queue for job distribution
- **S3**: Stores generated HTML and JSON artifacts

### Async Generation Flow

1. Client submits generation request with `async: true`
2. Server creates session record and queues job
3. Worker picks up job and generates landing
4. Results are stored in S3 and session is updated
5. Client polls status endpoint to check completion

### Example: Submit Async Job

```bash
curl -X POST https://your-service.onrender.com/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "brief": "Юридическая консультация по налоговому праву",
    "page_type": "invest",
    "sessionId": "session-123",
    "async": true
  }'
```

Response:
```json
{
  "sessionId": "session-123",
  "status": "pending",
  "message": "Job queued successfully"
}
```

### Example: Check Job Status

```bash
curl https://your-service.onrender.com/status/session-123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response (completed):
```json
{
  "sessionId": "session-123",
  "status": "completed",
  "result": {
    "urls": {
      "jsonUrl": "https://s3.amazonaws.com/...",
      "htmlUrl": "https://s3.amazonaws.com/..."
    }
  },
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:45Z"
}
```

### Environment Variables

For autonomous mode, configure:

```bash
# OpenAI
OPENAI_API_KEY=sk-...

# Authentication
ALLOWED_TOKEN=your-secret-token

# Database (Supabase or any PostgreSQL)
DATABASE_URL=postgresql://...

# Queue (Upstash Redis or any Redis)
REDIS_URL=redis://...

# Storage (AWS S3)
S3_BUCKET=your-bucket-name
S3_ACCESS_KEY_ID=AKIA...
S3_SECRET_ACCESS_KEY=...
S3_REGION=us-east-1

# Optional
WORKER_CONCURRENCY=5  # Number of concurrent jobs
```

### Running Services

```bash
# Start web service
npm start

# Start worker (in separate terminal)
npm run worker

# Run database migrations
npm run migrate
```

### Deployment

See [docs/DEPLOY_RENDER.md](docs/DEPLOY_RENDER.md) for detailed deployment instructions for Render.com.

## Notes
- Do not expose `OPENAI_API_KEY` on the client. All calls must go through the server.
- See `README_Version4.md` for detailed documentation.
