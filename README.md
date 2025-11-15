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

4. Build and run (container): use Dockerfile or deploy to Render (set `OPENAI_API_KEY` or `OPENAI_KEY` in Render Environment)

## API

### POST /api/generate
- **body**: `{ prompt: string, model?: string }`
- **returns**: `{ text }`

### Legacy endpoints
The server maintains backward compatibility with existing `/generate` and `/export` endpoints.

## Autonomous Mode

The service supports both **synchronous** and **asynchronous** landing page generation modes.

### Environment Variables

**Key Compatibility:**
- `OPENAI_KEY` - Primary OpenAI API key (recommended)
- `OPENAI_API_KEY` - Backward compatibility support

Both variables are supported. If both are set, `OPENAI_KEY` takes precedence.

**Required for Async Mode:**
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string (supports TLS with rediss://)
- `S3_BUCKET` - S3 bucket name for artifact storage
- `S3_ACCESS_KEY_ID` - AWS access key ID
- `S3_SECRET_ACCESS_KEY` - AWS secret access key
- `S3_REGION` - AWS region (default: us-east-1)

**Optional:**
- `ALLOWED_TOKEN` - API authentication token
- `WORKER_CONCURRENCY` - Worker concurrency level (default: 2)

### Synchronous Generation (Default)

Traditional request-response flow. The API waits for generation to complete before responding.

```bash
curl -X POST https://your-service.onrender.com/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "brief": "Услуги корпоративного юриста для стартапов",
    "page_type": "invest",
    "sessionId": "session-123"
  }'
```

**Response:**
```json
{
  "hero": {
    "title": "Корпоративный юрист для стартапов",
    "subtitle": "Профессиональная правовая поддержка",
    "cta": "Получить консультацию"
  },
  "benefits": [...],
  "process": [...],
  "faq": [...],
  "seo": {...}
}
```

### Asynchronous Generation (New)

Jobs are queued for background processing via Redis/BullMQ. Results are stored in PostgreSQL and artifacts in S3.

**1. Submit Generation Job:**

```bash
curl -X POST https://your-service.onrender.com/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "brief": "Услуги корпоративного юриста для стартапов",
    "page_type": "invest",
    "sessionId": "session-123",
    "async": true
  }'
```

**Response:**
```json
{
  "sessionId": "session-123",
  "status": "pending",
  "message": "Job queued for processing"
}
```

**2. Check Job Status:**

```bash
curl https://your-service.onrender.com/status/session-123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response (Completed):**
```json
{
  "sessionId": "session-123",
  "status": "completed",
  "data": {
    "hero": {...},
    "benefits": [...],
    "process": [...],
    "faq": [...],
    "seo": {...}
  },
  "s3": {
    "jsonUrl": "https://bucket.s3.region.amazonaws.com/landings/session-123/landing.json",
    "htmlUrl": "https://bucket.s3.region.amazonaws.com/landings/session-123/landing.html"
  },
  "completedAt": "2024-01-01T12:00:00.000Z"
}
```

**Response (Processing):**
```json
{
  "sessionId": "session-123",
  "status": "processing"
}
```

**Response (Failed):**
```json
{
  "sessionId": "session-123",
  "status": "failed",
  "error": "Error message"
}
```

### Architecture Flow

```
Client Request (async=true)
    ↓
Web Service (Express)
    ↓
Add Job to Redis Queue (BullMQ)
    ↓
Store Session in PostgreSQL (status: pending)
    ↓
Return sessionId to Client
    ↓
Worker Process (Background)
    ↓
1. Update status: processing
2. Call OpenAI API
3. Generate HTML
4. Upload to S3
5. Update session: completed
```

### Running Locally

**Start all services:**

```bash
# Terminal 1: Start web server
npm run dev

# Terminal 2: Start worker
npm run worker

# Terminal 3: Run migrations (first time only)
npm run migrate
```

**Local environment setup:**
```bash
# .env file
OPENAI_KEY=sk-your-key-here
DATABASE_URL=postgresql://localhost:5432/createlen
REDIS_URL=redis://localhost:6379
S3_BUCKET=your-bucket
S3_ACCESS_KEY_ID=your-key
S3_SECRET_ACCESS_KEY=your-secret
S3_REGION=us-east-1
ALLOWED_TOKEN=test-token
```

### Deployment

See [docs/DEPLOY_RENDER.md](docs/DEPLOY_RENDER.md) for complete deployment guide including:
- Render.com setup with render.yaml
- Environment variable configuration
- Upstash Redis setup
- AWS S3 configuration
- Database migrations
- Monitoring and troubleshooting

## Notes
- Do not expose `OPENAI_API_KEY` on the client. All calls must go through the server.
- See `README_Version4.md` for detailed documentation.
- For production deployments, use async mode for better scalability and reliability.
