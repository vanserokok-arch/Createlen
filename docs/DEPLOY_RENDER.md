# Deploying Createlen to Render

This guide walks you through deploying the Createlen landing page generation system to Render.

## Prerequisites

1. **Render Account**: Sign up at [render.com](https://render.com)
2. **Upstash Redis**: Create a Redis instance at [upstash.com](https://upstash.com)
3. **AWS S3**: Set up an S3 bucket for artifact storage
4. **OpenAI API Key**: Get your API key from [platform.openai.com](https://platform.openai.com)

## Step 1: Set Up External Services

### Upstash Redis

1. Create a new Redis database at [console.upstash.com](https://console.upstash.com)
2. Copy the Redis URL (format: `redis://default:password@host:port`)
3. Save this for later as `REDIS_URL`

### AWS S3

1. Create an S3 bucket (e.g., `createlen-artifacts`)
2. Set the bucket to allow public read access for uploaded files
3. Create an IAM user with S3 permissions:
   - `s3:PutObject`
   - `s3:GetObject`
   - `s3:PutObjectAcl`
4. Generate access keys and save:
   - `S3_ACCESS_KEY_ID`
   - `S3_SECRET_ACCESS_KEY`
   - `S3_BUCKET` (bucket name)
   - `S3_REGION` (e.g., `us-east-1`)

## Step 2: Deploy to Render

### Option A: Deploy with render.yaml (Recommended)

1. Fork/clone this repository to your GitHub account
2. In Render dashboard, click "New" → "Blueprint"
3. Connect your GitHub repository
4. Render will automatically detect `render.yaml` and create:
   - Web service (API server)
   - Worker service (background job processor)
   - PostgreSQL database

### Option B: Manual Setup

#### Create PostgreSQL Database

1. In Render dashboard: "New" → "PostgreSQL"
2. Name: `createlen-db`
3. Database: `createlen`
4. User: `createlen`
5. Plan: Starter (or higher)
6. Save the internal connection string

#### Create Web Service

1. "New" → "Web Service"
2. Connect your repository
3. Settings:
   - **Name**: `createlen-web`
   - **Environment**: Node
   - **Build Command**: `npm ci`
   - **Start Command**: `node server/index.js`
   - **Plan**: Starter

#### Create Worker Service

1. "New" → "Background Worker"
2. Connect your repository
3. Settings:
   - **Name**: `createlen-worker`
   - **Environment**: Node
   - **Build Command**: `npm ci`
   - **Start Command**: `node worker/worker.js`
   - **Plan**: Starter

## Step 3: Configure Environment Variables

Set these environment variables for **both** Web and Worker services:

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENAI_KEY` or `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `ALLOWED_TOKEN` | API authentication token | `your-secret-token` |
| `DATABASE_URL` | PostgreSQL connection string | Auto-filled from database |
| `REDIS_URL` | Upstash Redis connection URL | `redis://default:...@host:port` |
| `S3_BUCKET` | S3 bucket name | `createlen-artifacts` |
| `S3_ACCESS_KEY_ID` | AWS access key ID | `AKIA...` |
| `S3_SECRET_ACCESS_KEY` | AWS secret access key | `...` |
| `S3_REGION` | AWS region | `us-east-1` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `PORT` | Server port | `3000` |

## Step 4: Run Database Migration

After the database is created, run the migration:

### Method 1: Using Render Shell

1. Go to your database in Render dashboard
2. Click "Connect" → "External Connection"
3. Copy the connection command (psql)
4. Run locally:
   ```bash
   psql "postgres://user:pass@host/db" < scripts/migrate.sql
   ```

### Method 2: Using Render Dashboard

1. Go to your database in Render dashboard
2. Click "Connect" → "PSQL Command"
3. Copy and paste the SQL from `scripts/migrate.sql`

### Method 3: Using pgAdmin or Similar Tool

1. Connect to your Render PostgreSQL database
2. Run the SQL from `scripts/migrate.sql`

## Step 5: Verify Deployment

### Check Health Endpoints

```bash
# Basic health check
curl https://your-app.onrender.com/health

# Detailed health check
curl https://your-app.onrender.com/health/detailed

# Readiness check
curl https://your-app.onrender.com/health/ready
```

### Test Async Generation

```bash
curl -X POST https://your-app.onrender.com/api/generate \
  -H "Content-Type: application/json" \
  -H "x-api-token: your-secret-token" \
  -d '{
    "brief": "Modern law firm specializing in investment law",
    "page_type": "invest",
    "async": true
  }'
```

Response:
```json
{
  "sessionId": "session-1234567890-abc123",
  "status": "queued",
  "message": "Landing page generation has been queued..."
}
```

### Check Generation Status

```bash
curl https://your-app.onrender.com/api/status/session-1234567890-abc123 \
  -H "x-api-token: your-secret-token"
```

Response (when completed):
```json
{
  "sessionId": "session-1234567890-abc123",
  "status": "completed",
  "artifactUrl": "https://your-bucket.s3.amazonaws.com/landings/session-1234567890-abc123/index.html",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:01:00.000Z"
}
```

## Troubleshooting

### Worker Not Processing Jobs

1. Check worker logs in Render dashboard
2. Verify `REDIS_URL` is correct
3. Verify `OPENAI_KEY` is set
4. Check Redis connection: logs should show "Worker started and waiting for jobs..."

### S3 Upload Failures

1. Verify S3 credentials are correct
2. Check bucket permissions (must allow public-read ACL)
3. Verify bucket region matches `S3_REGION`

### Database Connection Issues

1. Verify `DATABASE_URL` is set correctly
2. Check database is running in Render dashboard
3. Verify migration was run successfully

### OpenAI API Errors

1. Verify API key is valid
2. Check OpenAI account has sufficient credits
3. Monitor rate limits

## Monitoring

### Render Dashboard

- **Web Service**: Monitor request logs, errors, CPU/memory usage
- **Worker Service**: Monitor job processing logs, errors
- **Database**: Monitor connections, storage usage

### Health Checks

Set up monitoring alerts using the health endpoints:
- `/health` - Basic liveness
- `/health/ready` - Readiness (database + Redis)
- `/health/detailed` - All services status

## Scaling

### Horizontal Scaling

Render allows you to increase the number of instances:
- Web service: Scale up to handle more concurrent requests
- Worker service: Scale up to process more jobs in parallel

### Vertical Scaling

Upgrade to higher plans for more CPU/memory:
- Starter → Standard → Pro

### Cost Optimization

- Use Starter plans for development/testing
- Monitor usage and scale based on demand
- Implement job priority queues to optimize worker usage

## Security Best Practices

1. **Rotate credentials regularly** - especially `OPENAI_KEY` and `ALLOWED_TOKEN`
2. **Use Render's environment groups** - for shared variables across services
3. **Enable Render's built-in DDoS protection**
4. **Monitor API usage** - set up alerts for unusual patterns
5. **Implement rate limiting** - protect against abuse

## Next Steps

- Set up monitoring and alerting
- Implement request logging (e.g., with Logtail)
- Add error tracking (e.g., with Sentry)
- Set up CI/CD with GitHub Actions
- Implement caching for frequently used prompts
