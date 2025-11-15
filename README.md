# Createlen (keis-replit-generator)

Landing page generation service with OpenAI integration. Supports both synchronous and asynchronous generation modes with background job processing.

## Features

- **Synchronous Generation**: Immediate HTML generation via OpenAI API
- **Asynchronous Generation**: Queue-based generation with BullMQ and Redis
- **Session Tracking**: PostgreSQL database for tracking generation status
- **S3 Storage**: Automatic upload of generated landing pages to S3
- **Health Monitoring**: Comprehensive health check endpoints
- **Worker Process**: Background worker for processing queued jobs

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Client    │─────▶│  Web Server  │─────▶│  PostgreSQL │
└─────────────┘      └──────────────┘      └─────────────┘
                            │
                            ├─────────────▶ ┌──────────────┐
                            │               │    Redis     │
                            │               │  (BullMQ)    │
                            │               └──────────────┘
                            │                      │
                            ▼                      ▼
                     ┌──────────────┐      ┌──────────────┐
                     │   OpenAI     │◀─────│    Worker    │
                     │     API      │      │   Process    │
                     └──────────────┘      └──────────────┘
                                                  │
                                                  ▼
                                           ┌──────────────┐
                                           │   S3 Bucket  │
                                           └──────────────┘
```

## Quickstart

### Local Development

1. Install dependencies:
   ```bash
   npm ci
   ```

2. Create `.env` file with required variables:
   ```env
   OPENAI_KEY=sk-...
   ALLOWED_TOKEN=your-secret-token
   DATABASE_URL=postgresql://user:pass@localhost:5432/createlen
   REDIS_URL=redis://localhost:6379
   S3_BUCKET=your-bucket
   S3_ACCESS_KEY_ID=...
   S3_SECRET_ACCESS_KEY=...
   S3_REGION=us-east-1
   ```

3. Set up PostgreSQL database:
   ```bash
   createdb createlen
   psql createlen < scripts/migrate.sql
   ```

4. Start services:
   ```bash
   # Terminal 1: Start web server
   npm start
   
   # Terminal 2: Start worker
   npm run start:worker
   ```

5. Test the API:
   ```bash
   # Async generation
   curl -X POST http://localhost:3000/api/generate \
     -H "Content-Type: application/json" \
     -H "x-api-token: your-secret-token" \
     -d '{"brief": "Investment law firm", "async": true}'
   
   # Check status
   curl http://localhost:3000/api/status/{sessionId} \
     -H "x-api-token: your-secret-token"
   ```

## API Reference

### POST /api/generate

Generate a landing page (sync or async mode).

**Headers:**
- `x-api-token`: Authentication token

**Request Body:**
```json
{
  "brief": "Description of the landing page to generate",
  "page_type": "invest",
  "model": "gpt-3.5-turbo",
  "async": true
}
```

**Response (async mode):**
```json
{
  "sessionId": "session-1234567890-abc123",
  "status": "queued",
  "message": "Landing page generation has been queued..."
}
```

**Response (sync mode):**
```json
{
  "html": "<!DOCTYPE html>...",
  "model": "gpt-3.5-turbo",
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 500,
    "total_tokens": 600
  }
}
```

### GET /api/status/:sessionId

Check the status of an async generation job.

**Headers:**
- `x-api-token`: Authentication token

**Response:**
```json
{
  "sessionId": "session-1234567890-abc123",
  "status": "completed",
  "artifactUrl": "https://bucket.s3.amazonaws.com/landings/session-123/index.html",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:01:00.000Z"
}
```

**Status Values:**
- `queued`: Job is waiting to be processed
- `processing`: Job is currently being processed
- `completed`: Job finished successfully
- `failed`: Job failed (check logs for details)

### GET /health

Basic liveness check.

**Response:**
```json
{
  "status": "alive",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### GET /health/ready

Readiness check (verifies database and Redis connectivity).

**Response:**
```json
{
  "status": "ready",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "checks": {
    "database": true,
    "queue": true
  }
}
```

### GET /health/detailed

Comprehensive health check of all services.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "database": { "status": "healthy", "available": true },
    "queue": { "status": "healthy", "available": true },
    "s3": { "status": "healthy", "available": true }
  }
}
```

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `OPENAI_KEY` or `OPENAI_API_KEY` | OpenAI API key |
| `ALLOWED_TOKEN` | API authentication token |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection URL (Upstash format) |
| `S3_BUCKET` | S3 bucket name |
| `S3_ACCESS_KEY_ID` | AWS access key |
| `S3_SECRET_ACCESS_KEY` | AWS secret key |
| `S3_REGION` | AWS region (e.g., us-east-1) |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `development` |
| `PORT` | Server port | `3000` |

## Deployment

See [docs/DEPLOY_RENDER.md](docs/DEPLOY_RENDER.md) for detailed deployment instructions to Render.

Quick deploy with Render Blueprint:
1. Fork this repository
2. Connect to Render
3. Render will auto-detect `render.yaml` and create all services
4. Set environment variables
5. Run database migration

## Development

### Running Tests

```bash
npm test
```

### Running Linter

```bash
npm run lint
```

### Database Migrations

```bash
psql "$DATABASE_URL" < scripts/migrate.sql
```

## Legacy Endpoints

The service maintains backward compatibility with the original `/generate` endpoint.

### POST /generate

**Request Body:**
```json
{
  "brief": "Description",
  "page_type": "invest",
  "sessionId": "optional-session-id",
  "async": false
}
```

## Project Structure

```
.
├── server/
│   ├── index.js           # Main server entry point
│   ├── db.js              # PostgreSQL connection and queries
│   ├── queue.js           # BullMQ queue setup
│   ├── s3.js              # S3 upload functionality
│   ├── health.js          # Health check endpoints
│   ├── generate.js        # Generation logic
│   └── worker-process.js  # Worker process management
├── worker/
│   └── worker.js          # Background job processor
├── scripts/
│   └── migrate.sql        # Database migration
├── docs/
│   └── DEPLOY_RENDER.md   # Deployment guide
├── .github/
│   └── workflows/
│       ├── ci.yml         # CI/CD pipeline
│       └── push-and-open-pr.yml
├── render.yaml            # Render configuration
└── package.json
```

## Security Notes

- Never commit `.env` file or expose secrets
- Use strong authentication tokens
- Rotate credentials regularly
- Monitor API usage and costs
- Implement rate limiting in production
- Review S3 bucket permissions

## TODO

- [ ] Add retry logic for transient errors
- [ ] Implement observability (metrics, tracing)
- [ ] Add idempotency keys for API requests
- [ ] Implement job priority queues
- [ ] Add request caching
- [ ] Implement content moderation
- [ ] Add A/B testing support
- [ ] Add cost tracking and limits

## Contributing

See existing code style and patterns. Make minimal changes and ensure tests pass.

## License

See LICENSE file for details.
