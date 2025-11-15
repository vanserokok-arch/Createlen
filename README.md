# Createlen (keis-replit-generator)

Small Express service that generates and packages simple projects with OpenAI integration. Now supports both synchronous and asynchronous autonomous landing page generation with cloud storage.

## Features

- 🤖 **OpenAI Integration**: Generate landing pages using GPT-4o-mini
- ⚡ **Sync & Async Modes**: Choose between immediate response or background processing
- 📦 **Cloud Storage**: Store generated pages in S3/Supabase Storage
- 🔄 **Job Queue**: BullMQ-powered async processing with Upstash Redis
- 💾 **PostgreSQL**: Session tracking and job status persistence
- 🚀 **Production Ready**: Deploy to Render.com with full infrastructure

## Quickstart

1. Install dependencies:
   ```bash
   npm ci
   ```

2. Create `.env` from `.env.example` and configure required services:
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. Run database migrations (requires PostgreSQL):
   ```bash
   node -e "import('./server/db.js').then(m => m.initMigrations())"
   ```

4. Run locally:
   ```bash
   # Start web server
   npm run dev
   
   # Start worker (in separate terminal)
   node worker/worker.js
   ```

5. Deploy to production: See [docs/DEPLOY_RENDER.md](docs/DEPLOY_RENDER.md)

## API

### POST /api/generate
Simple OpenAI text generation endpoint.

- **body**: `{ prompt: string, model?: string }`
- **returns**: `{ text }`

### POST /generate (Synchronous)
Generate landing page and return immediately.

```bash
curl -X POST https://your-service.onrender.com/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "brief": "Юридические услуги для стартапов",
    "page_type": "invest",
    "sessionId": "session-123"
  }'
```

**Response**: Landing page JSON data

### POST /generate (Asynchronous)
Queue landing page generation for background processing.

```bash
curl -X POST https://your-service.onrender.com/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "brief": "Помощь с регистрацией бизнеса",
    "page_type": "invest",
    "sessionId": "async-session-456",
    "async": true
  }'
```

**Response**: `{ status: "queued", sessionId: "async-session-456", jobId: "..." }`

The worker will:
1. Process the job from the queue
2. Call OpenAI to generate landing page data
3. Upload HTML and JSON to S3
4. Update session status in PostgreSQL with download URLs

### GET /export?sessionId=:id
Export generated landing page as ZIP file.

- **query**: `sessionId` (required), `token` (if ALLOWED_TOKEN is set)
- **returns**: ZIP file containing `landing.html` and `landing.json`

### GET /health
Health check endpoint for monitoring.

- **returns**: System health status including database, queue, and service checks

## Autonomous Mode

The autonomous mode enables background processing of landing page generation jobs:

### How It Works

1. **Client submits request** with `async: true`
2. **Web service** creates session in PostgreSQL and enqueues job
3. **Worker service** picks up job from Redis queue
4. **Worker** calls OpenAI API to generate content
5. **Worker** uploads HTML/JSON to S3 and generates presigned URLs
6. **Worker** updates session status with download links
7. **Client** polls session status or receives webhook notification

### Flow Diagram

```
Client → [POST /generate async=true] → Web Service
                                            ↓
                                      PostgreSQL (session created)
                                            ↓
                                      Redis Queue (job enqueued)
                                            ↓
                                      Worker Service
                                            ↓
                                      OpenAI API (generate content)
                                            ↓
                                      S3 Storage (upload files)
                                            ↓
                                      PostgreSQL (update status)
                                            ↓
Client ← [GET /status/:sessionId] ← Download URLs
```

### Environment Variables

The system supports both `OPENAI_KEY` and `OPENAI_API_KEY` for compatibility:

```bash
# Both work (OPENAI_KEY takes precedence)
OPENAI_KEY=sk-...
OPENAI_API_KEY=sk-...
```

See `.env.example` for complete configuration options.

## Legacy Endpoints

The server maintains backward compatibility with existing endpoints:
- POST `/generate` - Synchronous generation (original behavior)
- GET `/export` - Export generated landing pages

## Deployment

Deploy to Render.com with automatic infrastructure setup:

1. Connect your repository to Render
2. Configure environment variables
3. Deploy using `render.yaml`

See [docs/DEPLOY_RENDER.md](docs/DEPLOY_RENDER.md) for detailed instructions.

## Development

### Project Structure

```
Createlen/
├── server.js           # Main Express server
├── worker/
│   └── worker.js       # BullMQ worker for async jobs
├── server/
│   ├── db.js           # PostgreSQL wrapper
│   ├── queue.js        # BullMQ producer
│   ├── s3.js           # S3 storage helper
│   ├── health.js       # Health check endpoints
│   └── redis-connection.js
├── scripts/
│   └── migrate.sql     # Database migrations
├── docs/
│   └── DEPLOY_RENDER.md
└── src/
    ├── routes/
    └── services/
```

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

## Security

- ✅ Never commit secrets to version control
- ✅ Use environment variables for all credentials
- ✅ Validate requests with `ALLOWED_TOKEN`
- ✅ Use HTTPS in production (default on Render)
- ✅ Regularly rotate API keys and tokens

## Notes

- Do not expose `OPENAI_KEY` or `OPENAI_API_KEY` on the client
- All OpenAI calls must go through the server
- S3 presigned URLs expire after 7 days (configurable)
- Worker processes up to 5 jobs concurrently
- Failed jobs are retried 3 times with exponential backoff

## License

See [LICENSE](LICENSE) file.

## Documentation

- [Deployment Guide](docs/DEPLOY_RENDER.md)
- [API Reference](README_Version4.md)
