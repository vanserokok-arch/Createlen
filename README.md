# Createlen

Autonomous landing page generator for Russian law firms using OpenAI.

## Features

- **Async Generation**: Queue landing page generation jobs for background processing
- **OpenAI Integration**: Uses GPT-4o-mini for cost-effective content generation
- **Distributed Architecture**: Separate web server and worker processes
- **Persistent Storage**: PostgreSQL for job tracking, S3 for artifacts
- **Production Ready**: Includes health checks, error handling, and deployment configs

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Redis instance (Upstash recommended)
- AWS S3 bucket
- OpenAI API key

### Installation

```bash
# Clone repository
git clone https://github.com/vanserokok-arch/Createlen.git
cd Createlen

# Install dependencies
npm ci

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Run database migration
psql "$DATABASE_URL" -f scripts/migrate.sql

# Start web server
npm start

# Start worker (in separate terminal)
npm run worker
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key | Yes |
| `ALLOWED_TOKEN` | API authentication token | Yes |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `REDIS_URL` | Redis connection string | Yes |
| `S3_BUCKET` | S3 bucket name | Yes |
| `S3_ACCESS_KEY_ID` | AWS access key ID | Yes |
| `S3_SECRET_ACCESS_KEY` | AWS secret access key | Yes |
| `S3_REGION` | AWS region (default: us-east-1) | No |
| `PORT` | Server port (default: 3000) | No |

## API Usage

### Synchronous Generation

```bash
curl -X POST http://localhost:3000/generate \
  -H "Content-Type: application/json" \
  -d '{
    "token": "your-token",
    "brief": "Юридические услуги для бизнеса",
    "page_type": "corporate"
  }'
```

Response:
```json
{
  "content": { ... },
  "html": "<!doctype html>...",
  "sessionId": "uuid"
}
```

### Asynchronous Generation

```bash
curl -X POST http://localhost:3000/generate \
  -H "Content-Type: application/json" \
  -d '{
    "token": "your-token",
    "brief": "Инвестиционная компания",
    "page_type": "invest",
    "async": true
  }'
```

Response:
```json
{
  "sessionId": "uuid",
  "status": "queued",
  "message": "Generation job queued. Check status with GET /status/:sessionId"
}
```

### Check Status

```bash
curl http://localhost:3000/status/uuid?token=your-token
```

Response:
```json
{
  "sessionId": "uuid",
  "status": "completed",
  "artifactUrl": "https://bucket.s3.region.amazonaws.com/landings/uuid/landing.html",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:01:00.000Z"
}
```

### Health Check

```bash
curl http://localhost:3000/health
```

## Deployment

### Render.com

See [docs/DEPLOY_RENDER.md](docs/DEPLOY_RENDER.md) for detailed deployment instructions.

Quick deploy:
1. Fork this repository
2. Create services on Render using `render.yaml`
3. Set environment variables
4. Run database migration
5. Done!

### Docker

```bash
# Build image
docker build -t createlen .

# Run web server
docker run -p 3000:3000 --env-file .env createlen

# Run worker
docker run --env-file .env createlen npm run worker
```

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│  Web Server  │────▶│    Redis    │
└─────────────┘     └──────────────┘     └─────────────┘
                           │                     │
                           ▼                     ▼
                    ┌──────────────┐     ┌─────────────┐
                    │  PostgreSQL  │◀────│   Worker    │
                    └──────────────┘     └─────────────┘
                                                │
                                                ▼
                                         ┌─────────────┐
                                         │     S3      │
                                         └─────────────┘
```

### Components

- **Web Server** (`server/index.js`): Handles API requests, queues jobs
- **Worker** (`worker/worker.js`): Processes jobs, calls OpenAI, uploads to S3
- **PostgreSQL**: Stores session metadata and job status
- **Redis**: BullMQ job queue for async processing
- **S3**: Stores generated HTML artifacts

## Database Schema

### sessions table

| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| session_id | text | Unique session identifier |
| status | text | queued, processing, completed, failed |
| payload | jsonb | Original request data |
| artifact_url | text | S3 URL of generated HTML |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

## Development

### Project Structure

```
Createlen/
├── server/
│   ├── index.js          # Main web server
│   ├── worker-process.js # Worker bootstrap
│   ├── db.js             # Database client
│   ├── queue.js          # BullMQ setup
│   ├── generate.js       # OpenAI integration
│   ├── s3.js             # S3 client
│   └── health.js         # Health checks
├── worker/
│   └── worker.js         # Job processor
├── scripts/
│   └── migrate.sql       # Database migration
├── docs/
│   └── DEPLOY_RENDER.md  # Deployment guide
├── .github/
│   └── workflows/
│       ├── ci.yml        # CI pipeline
│       └── push-and-open-pr.yml
├── render.yaml           # Render.com config
└── package.json
```

### Running Tests

```bash
npm test
```

### Adding Features

TODO items are marked throughout the codebase:
- Retry logic for transient failures
- Request rate limiting
- Comprehensive error logging (Sentry)
- Caching for repeated requests
- Job progress reporting
- Observability and metrics

## Troubleshooting

### Common Issues

**"OpenAI API error: 401"**
- Check `OPENAI_API_KEY` is set correctly
- Verify API key is active in OpenAI dashboard

**"Database connection failed"**
- Check `DATABASE_URL` is correct
- Verify database is running and accessible
- Ensure migration has been run

**"Worker not processing jobs"**
- Check `REDIS_URL` is correct
- Verify worker process is running
- Check worker logs for errors

**"S3 upload failed"**
- Verify S3 credentials are correct
- Check bucket exists and is accessible
- Ensure IAM user has `s3:PutObject` permission

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## License

MIT

## Support

- GitHub Issues: https://github.com/vanserokok-arch/Createlen/issues
- Documentation: [docs/](docs/)
