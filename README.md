# Createlen

Autonomous landing page generation system powered by OpenAI. Createlen accepts a brief in Russian and generates professional landing pages for law firms, complete with SEO-optimized content, structured sections, and ready-to-deploy HTML.

## Features

- 🤖 **AI-Powered Generation**: Uses OpenAI GPT-4 to generate landing page content
- 🔄 **Autonomous Processing**: Background job queue for asynchronous generation
- 💾 **Persistent Storage**: PostgreSQL database for session tracking
- 📦 **Artifact Storage**: S3-compatible storage for generated HTML and JSON files
- 🚀 **Production Ready**: Health checks, monitoring, and CI/CD pipeline
- 🔐 **Secure**: Token-based authentication and environment variable configuration

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Redis instance
- S3-compatible storage (AWS S3, MinIO, etc.)
- OpenAI API key

### Installation

```bash
# Clone the repository
git clone https://github.com/vanserokok-arch/Createlen.git
cd Createlen

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migration
psql $DATABASE_URL < scripts/migrate.sql

# Start the web server
npm start

# Start the worker (in another terminal)
node worker/worker.js
```

### Environment Variables

Create a `.env` file with the following variables:

```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# OpenAI Configuration
OPENAI_KEY=sk-your-openai-api-key

# Authentication
ALLOWED_TOKEN=your-secret-token

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/createlen

# Redis Configuration
REDIS_URL=redis://localhost:6379

# S3 Configuration
S3_BUCKET=your-bucket-name
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_REGION=us-east-1
```

## Autonomous Mode

The autonomous mode allows you to submit landing page generation requests that are processed asynchronously in the background.

### Workflow

1. **Submit Brief**: Client sends a POST request to `/generate` with a brief
2. **Queue Job**: Server creates a database session and adds job to Redis queue
3. **Process Job**: Background worker picks up the job and calls OpenAI
4. **Save Artifacts**: Worker uploads generated JSON and HTML to S3
5. **Update Status**: Worker updates the database with results and URLs
6. **Retrieve Results**: Client can query the database or S3 for the results

### API Usage

#### Generate Landing Page (Synchronous - Legacy)

The original synchronous endpoint still works for immediate results:

```bash
curl -X POST http://localhost:3000/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secret-token" \
  -d '{
    "brief": "Юридическая помощь по инвестиционным спорам в России",
    "page_type": "invest",
    "token": "your-secret-token"
  }'
```

Response:
```json
{
  "hero": {
    "title": "Профессиональная защита инвестиционных интересов",
    "subtitle": "Опытные юристы по инвестиционным спорам в России",
    "cta": "Получить консультацию"
  },
  "benefits": [...],
  "process": [...],
  "faq": [...],
  "seo": {...}
}
```

#### Generate Landing Page (Asynchronous - Autonomous)

For autonomous processing, integrate with the queue system:

```javascript
// In your server endpoint (example)
import { addGenerationJob } from './server/queue.js';
import { createSession } from './server/db.js';

app.post('/generate-async', async (req, res) => {
  const { brief, page_type = 'invest', sessionId } = req.body;
  
  // Create database session
  const session = await createSession(sessionId, brief, page_type);
  
  // Add job to queue
  await addGenerationJob(sessionId, brief, page_type);
  
  res.json({
    sessionId,
    status: 'pending',
    message: 'Job queued for processing'
  });
});
```

#### Export Landing Page

Get the generated landing page as a ZIP file:

```bash
curl -X GET "http://localhost:3000/export?sessionId=test-session-1&token=your-secret-token" \
  -o landing.zip
```

The ZIP contains:
- `landing.html` - Ready-to-use HTML file
- `landing.json` - Structured data in JSON format

#### Health Check

Check service health and dependencies:

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T12:00:00.000Z",
  "uptime": 123.45,
  "responseTime": 45,
  "dependencies": {
    "database": {
      "status": "healthy",
      "message": "Database connection OK"
    },
    "queue": {
      "status": "healthy",
      "message": "Queue connection OK"
    },
    "s3": {
      "status": "configured",
      "message": "S3 credentials present"
    },
    "openai": {
      "status": "configured",
      "message": "OpenAI API key present"
    }
  }
}
```

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Client    │─────▶│  Web Server  │─────▶│    Redis    │
└─────────────┘      │  (Express)   │      │   (Queue)   │
                     └──────────────┘      └─────────────┘
                            │                      │
                            │                      ▼
                            │              ┌──────────────┐
                            │              │    Worker    │
                            │              │   (BullMQ)   │
                            │              └──────────────┘
                            │                      │
                            ▼                      ▼
                     ┌──────────────┐      ┌─────────────┐
                     │  PostgreSQL  │      │   OpenAI    │
                     │  (Sessions)  │      │     API     │
                     └──────────────┘      └─────────────┘
                                                  │
                                                  ▼
                                           ┌─────────────┐
                                           │     S3      │
                                           │  (Storage)  │
                                           └─────────────┘
```

## Database Schema

The `sessions` table tracks all landing page generation requests:

```sql
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    brief TEXT,
    page_type VARCHAR(100),
    payload_json JSONB,
    s3_json_url TEXT,
    s3_html_url TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

Status values:
- `pending`: Job queued, waiting for worker
- `processing`: Worker is currently processing the job
- `completed`: Job completed successfully
- `failed`: Job failed (see error_message)

## Deployment

See [docs/DEPLOY_RENDER.md](docs/DEPLOY_RENDER.md) for detailed deployment instructions on Render.com.

### Deploy to Render.com

1. Push code to GitHub
2. Connect repository to Render
3. Use `render.yaml` blueprint for automatic setup
4. Configure environment variables
5. Run database migration
6. Deploy!

The `render.yaml` file defines:
- Web service (Express API)
- Worker service (background processor)
- PostgreSQL database
- Redis instance

## CI/CD

GitHub Actions workflow runs on every push and PR:

```yaml
- Install dependencies
- Run linter (if present)
- Run tests (if present)
- Build (if present)
```

See [.github/workflows/ci.yml](.github/workflows/ci.yml) for details.

## Development

### Project Structure

```
Createlen/
├── server.js              # Main Express server
├── worker/
│   └── worker.js          # Background job processor
├── server/
│   ├── db.js              # PostgreSQL client wrapper
│   ├── queue.js           # Redis queue producer
│   ├── s3.js              # S3 upload helper
│   └── health.js          # Health check endpoint
├── scripts/
│   └── migrate.sql        # Database migration
├── docs/
│   └── DEPLOY_RENDER.md   # Deployment guide
├── .github/
│   └── workflows/
│       └── ci.yml         # CI pipeline
├── render.yaml            # Render.com configuration
└── package.json           # Dependencies
```

### Adding New Features

1. **New API Endpoint**: Add to `server.js`
2. **Database Operations**: Add to `server/db.js`
3. **Queue Jobs**: Add to `server/queue.js` and `worker/worker.js`
4. **S3 Operations**: Add to `server/s3.js`

## Troubleshooting

### Worker not processing jobs
- Check Redis connection: `redis-cli ping`
- Verify `REDIS_URL` environment variable
- Check worker logs for errors

### Database connection errors
- Verify PostgreSQL is running
- Check `DATABASE_URL` format: `postgresql://user:pass@host:port/db`
- Run migration if tables don't exist

### S3 upload failures
- Verify AWS credentials are correct
- Check bucket exists and is accessible
- Verify bucket region matches `S3_REGION`

### OpenAI API errors
- Check API key is valid
- Monitor rate limits and quota
- Check OpenAI API status

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- GitHub Issues: https://github.com/vanserokok-arch/Createlen/issues
- Documentation: [docs/DEPLOY_RENDER.md](docs/DEPLOY_RENDER.md)

---

Built with ❤️ using Node.js, Express, OpenAI, PostgreSQL, Redis, and S3