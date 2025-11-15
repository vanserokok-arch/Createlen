# Deploying to Render.com

This guide provides detailed instructions for deploying the Createlen autonomous landing generation service to Render.com.

## Prerequisites

Before deploying, you'll need accounts and credentials for:

1. **Render.com** - Platform for hosting web services and workers
2. **Supabase** (or any PostgreSQL provider) - Database for session storage
3. **Upstash Redis** - Message queue for async task processing
4. **AWS S3** - Object storage for generated landing artifacts
5. **OpenAI** - API key for GPT-4 access

## Architecture Overview

The deployment consists of:
- **Web Service** - Express API server handling HTTP requests
- **Worker Service** - Background worker processing generation tasks from Redis queue
- **PostgreSQL Database** - Stores session state and metadata
- **Redis Queue** - BullMQ task queue for async processing
- **S3 Storage** - Stores generated HTML and JSON artifacts

## Step 1: Set Up External Services

### Supabase PostgreSQL

1. Go to [supabase.com](https://supabase.com/) and create a project
2. Navigate to Project Settings → Database
3. Copy the connection string (URI format)
4. Format: `postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres`
5. Save this as `DATABASE_URL`

### Upstash Redis

1. Go to [upstash.com](https://upstash.com/) and create a database
2. Select the region closest to your Render region
3. Copy the Redis connection URL
4. Format: `redis://:[PASSWORD]@[HOST]:6379`
5. Save this as `REDIS_URL`

### AWS S3

1. Log into AWS Console
2. Create an S3 bucket (e.g., `createlen-artifacts`)
3. Create IAM user with S3 access:
   - Go to IAM → Users → Add User
   - Attach policy: `AmazonS3FullAccess` or create custom policy
4. Generate access key credentials
5. Save the following:
   - `S3_BUCKET` - Your bucket name
   - `S3_ACCESS_KEY_ID` - IAM access key
   - `S3_SECRET_ACCESS_KEY` - IAM secret key
   - `S3_REGION` - Bucket region (e.g., `us-east-1`)

### OpenAI

1. Go to [platform.openai.com](https://platform.openai.com/)
2. Navigate to API Keys
3. Create a new API key
4. Save as `OPENAI_API_KEY`

## Step 2: Deploy to Render

### Option A: Deploy from Dashboard

1. Fork this repository to your GitHub account
2. Go to [render.com](https://render.com/) dashboard
3. Click "New" → "Blueprint"
4. Connect your GitHub repository
5. Select branch: `copilot/add-openai-scaffold`
6. Render will detect `render.yaml` and show deployment plan
7. Review services:
   - `createlen-api` (Web Service)
   - `createlen-worker` (Worker)
   - `createlen-db` (PostgreSQL)
8. Click "Apply" to start deployment

### Option B: Deploy with render.yaml

If you prefer Infrastructure as Code:

```bash
# Install Render CLI
brew install render-cli

# Login to Render
render login

# Deploy from render.yaml
render blueprint launch
```

## Step 3: Configure Environment Variables

After deployment, add the following environment variables to **both** web service and worker:

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `OPENAI_KEY` | Legacy alias for OPENAI_API_KEY | `sk-...` |
| `ALLOWED_TOKEN` | Bearer token for API auth | `your-secret-token` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |
| `REDIS_URL` | Redis connection string | `redis://...` |
| `S3_BUCKET` | S3 bucket name | `createlen-artifacts` |
| `S3_ACCESS_KEY_ID` | AWS access key | `AKIA...` |
| `S3_SECRET_ACCESS_KEY` | AWS secret key | `...` |
| `S3_REGION` | S3 region | `us-east-1` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `WORKER_CONCURRENCY` | Number of concurrent worker jobs | `5` |
| `PORT` | Web service port | `3000` |
| `NODE_ENV` | Environment | `production` |

### Setting Environment Variables

1. Go to your service in Render dashboard
2. Navigate to "Environment" tab
3. Click "Add Environment Variable"
4. Add each variable from the table above
5. Click "Save Changes"
6. Service will automatically redeploy

## Step 4: Run Database Migrations

After the database is created and web service is deployed:

### Via Render Shell

1. Go to web service dashboard
2. Click "Shell" tab
3. Run migration command:
   ```bash
   npm run migrate
   ```

### Via Local Connection

Alternatively, connect to the database locally:

```bash
# Set DATABASE_URL
export DATABASE_URL="postgresql://..."

# Run migrations
npm run migrate
```

## Step 5: Verify Deployment

### Health Check

Test the health endpoint:

```bash
curl https://your-service.onrender.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "checks": {
    "database": {
      "status": "healthy",
      "message": "Database connection successful"
    },
    "redis": {
      "status": "healthy",
      "message": "Redis connection successful"
    },
    "environment": {
      "status": "healthy",
      "message": "All required environment variables are set"
    }
  }
}
```

### Test Synchronous Generation

```bash
curl -X POST https://your-service.onrender.com/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ALLOWED_TOKEN" \
  -d '{
    "brief": "Юридическая консультация по налоговому праву",
    "page_type": "invest",
    "sessionId": "test-sync-1"
  }'
```

### Test Asynchronous Generation

```bash
# Submit async job
curl -X POST https://your-service.onrender.com/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ALLOWED_TOKEN" \
  -d '{
    "brief": "Юридическая консультация по налоговому праву",
    "page_type": "invest",
    "sessionId": "test-async-1",
    "async": true
  }'

# Check job status (TODO: implement status endpoint)
curl https://your-service.onrender.com/status/test-async-1 \
  -H "Authorization: Bearer YOUR_ALLOWED_TOKEN"
```

## Step 6: Monitor Services

### Render Dashboard

1. **Logs**: View real-time logs in service dashboard
2. **Metrics**: Monitor CPU, memory, and request metrics
3. **Events**: Check deployment and restart events

### Worker Monitoring

Monitor worker logs to see job processing:
```
🚀 Landing generation worker started
   Concurrency: 5
   Listening on queue: landing-generation
✅ Job test-async-1 completed
```

### Database Monitoring

Query sessions table to monitor job history:
```sql
SELECT session_id, status, created_at, updated_at
FROM sessions
ORDER BY created_at DESC
LIMIT 10;
```

## Troubleshooting

### Common Issues

#### 1. Health Check Failing

**Symptoms**: `/health` endpoint returns 503

**Solutions**:
- Check if all environment variables are set correctly
- Verify DATABASE_URL and REDIS_URL are accessible
- Check service logs for connection errors

#### 2. Worker Not Processing Jobs

**Symptoms**: Jobs stuck in "pending" status

**Solutions**:
- Verify worker service is running in Render dashboard
- Check worker logs for errors
- Confirm REDIS_URL is identical in web and worker services
- Test Redis connection: `redis-cli -u $REDIS_URL ping`

#### 3. S3 Upload Failures

**Symptoms**: Jobs fail with S3 errors

**Solutions**:
- Verify S3 credentials are correct
- Check IAM user has PutObject permission
- Confirm S3_BUCKET exists and region matches S3_REGION
- Test with AWS CLI: `aws s3 ls s3://your-bucket`

#### 4. Database Connection Issues

**Symptoms**: "database connection failed" errors

**Solutions**:
- Verify DATABASE_URL format
- Check if Supabase project is active
- Ensure connection pooling is enabled
- Test connection: `psql $DATABASE_URL -c "SELECT 1"`

## Performance Tuning

### Worker Concurrency

Adjust based on OpenAI API rate limits and server resources:

```bash
# In worker environment variables
WORKER_CONCURRENCY=10  # Process 10 jobs in parallel
```

### Database Connection Pool

Adjust in `server/db.js`:
```javascript
max: 20,  // Maximum connections
idleTimeoutMillis: 30000,  // Close idle connections after 30s
```

### Redis Memory

Configure eviction policy in Upstash:
- **allkeys-lru**: Recommended for queue
- **noeviction**: Keep all data (monitor memory)

## Scaling

### Horizontal Scaling

1. **Web Service**: Scale to multiple instances in Render dashboard
2. **Worker**: Increase worker count for higher throughput
3. **Database**: Upgrade Supabase plan for more connections
4. **Redis**: Upgrade Upstash plan for higher memory/throughput

### Vertical Scaling

Upgrade Render service plans:
- **Starter**: $7/month - 512MB RAM
- **Standard**: $25/month - 2GB RAM
- **Pro**: $85/month - 4GB RAM

## Cost Estimation

Monthly costs (approximate):

| Service | Plan | Cost |
|---------|------|------|
| Render Web | Starter | $7 |
| Render Worker | Starter | $7 |
| Render PostgreSQL | Starter | $7 |
| Upstash Redis | Free | $0 |
| Supabase (alternative) | Free | $0 |
| AWS S3 | Pay-as-you-go | $1-5 |
| OpenAI API | Pay-as-you-go | $10-50 |
| **Total** | | **$32-76/month** |

## Security Best Practices

1. **Never commit secrets** to Git
2. **Use environment variables** for all credentials
3. **Rotate API keys** regularly
4. **Enable S3 encryption** at rest
5. **Use HTTPS** for all endpoints
6. **Implement rate limiting** to prevent abuse
7. **Monitor access logs** for suspicious activity
8. **Set up alerts** for failed health checks

## Support

For issues or questions:
- Check service logs in Render dashboard
- Review error messages in worker logs
- Test external services independently
- Open GitHub issue with error details
