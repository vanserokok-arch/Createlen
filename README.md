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

The service supports asynchronous landing generation with background processing. Jobs are queued in Redis, processed by workers, and results are stored in S3 and PostgreSQL.

### Architecture

- **Web Service**: Express API server that handles requests and enqueues jobs
- **Worker Service**: Background worker that processes generation jobs
- **Queue**: Redis (Upstash) for job queue management
- **Storage**: AWS S3 for generated landing files
- **Database**: PostgreSQL (Supabase) for session/job metadata

### Asynchronous Generation Flow

1. Client sends POST request with `async=true` parameter
2. Server creates a session record in database and enqueues job
3. Server immediately returns session ID to client
4. Worker picks up job from queue
5. Worker calls generation API, creates landing files
6. Worker uploads ZIP to S3 and updates session with download URL
7. Client polls status endpoint to check completion

### API Examples

#### 1. Start Async Generation

```bash
curl -X POST https://your-app.onrender.com/api/generate-async \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ALLOWED_TOKEN" \
  -d '{
    "brief": "Юридические услуги для стартапов",
    "page_type": "invest"
  }'
```

Response:
```json
{
  "sessionId": "sess_abc123xyz",
  "status": "pending",
  "message": "Job queued for processing"
}
```

#### 2. Check Generation Status

```bash
curl -X GET https://your-app.onrender.com/api/status/sess_abc123xyz \
  -H "Authorization: Bearer YOUR_ALLOWED_TOKEN"
```

Response (pending):
```json
{
  "sessionId": "sess_abc123xyz",
  "status": "processing",
  "created_at": "2024-01-15T12:00:00.000Z"
}
```

Response (completed):
```json
{
  "sessionId": "sess_abc123xyz",
  "status": "completed",
  "s3_url": "https://presigned-download-url...",
  "created_at": "2024-01-15T12:00:00.000Z",
  "updated_at": "2024-01-15T12:01:30.000Z"
}
```

#### 3. Download Results

Once status is `completed`, use the `s3_url` from the status response:

```bash
curl -L "https://presigned-download-url..." -o landing.zip
```

### Environment Variables

Required for autonomous mode:

```bash
# Queue (Upstash Redis)
REDIS_URL=rediss://default:password@host:6379

# Storage (AWS S3)
S3_BUCKET=my-bucket
S3_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
S3_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/...
S3_REGION=us-east-1

# Database (Supabase PostgreSQL)
DATABASE_URL=postgresql://user:pass@host:5432/db
```

### Running Components

**Web Server:**
```bash
npm start
```

**Worker (separate process/container):**
```bash
npm run worker
```

**Database Migration:**
```bash
npm run migrate
```

### Deployment

See [docs/DEPLOY_RENDER.md](docs/DEPLOY_RENDER.md) for detailed deployment instructions on Render with all infrastructure setup.

## Notes
- Do not expose `OPENAI_API_KEY` on the client. All calls must go through the server.
- See `README_Version4.md` for detailed documentation.

