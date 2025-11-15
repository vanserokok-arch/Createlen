# Deployment Guide: Render.com

This guide covers deploying the Createlen autonomous landing generator to Render.com with async processing.

## Architecture Overview

- **Web Service**: Express API server handling sync/async generation requests
- **Worker Service**: BullMQ worker processing async jobs from Redis queue
- **PostgreSQL**: Session and job state storage (Supabase or Render PostgreSQL)
- **Redis**: Job queue (Upstash Redis recommended)
- **S3**: Landing page artifact storage (AWS S3 or Supabase Storage)

## Prerequisites

1. Render.com account
2. OpenAI API key
3. PostgreSQL database (Render PostgreSQL or Supabase)
4. Redis instance (Upstash Redis recommended)
5. S3-compatible storage (AWS S3 or Supabase Storage)

## Environment Variables

### Required for Both Web and Worker Services

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENAI_KEY` | OpenAI API key (primary) | `sk-...` |
| `OPENAI_API_KEY` | OpenAI API key (backward compat) | `sk-...` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `REDIS_URL` | Redis connection string (supports rediss:// for TLS) | `rediss://default:pass@host:6379` |
| `S3_BUCKET` | S3 bucket name | `createlen-artifacts` |
| `S3_ACCESS_KEY_ID` | AWS access key ID | `AKIA...` |
| `S3_SECRET_ACCESS_KEY` | AWS secret access key | `...` |
| `S3_REGION` | AWS region | `us-east-1` |

### Web Service Only

| Variable | Description | Example |
|----------|-------------|---------|
| `ALLOWED_TOKEN` | API access token for authentication | `your-secret-token` |
| `RENDER_API_KEY` | Render API key (optional) | `rnd_...` |
| `RENDER_SERVICE_ID` | Service ID (optional) | `srv-...` |

### Worker Service Only

| Variable | Description | Default |
|----------|-------------|---------|
| `WORKER_CONCURRENCY` | Number of concurrent jobs | `2` |

### Optional Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_SSL_REJECT_UNAUTHORIZED` | Validate SSL certificates for DB connection | `true` (set to `false` only if using self-signed certs) |

**Security Note:** Only set `DB_SSL_REJECT_UNAUTHORIZED=false` if your database uses self-signed certificates. For production deployments with proper SSL certificates, leave this unset (defaults to true).

## Deployment Steps

### 1. Set Up External Services

#### Upstash Redis (Recommended)

1. Go to [console.upstash.com](https://console.upstash.com)
2. Create a new Redis database
3. Select region closest to your Render region
4. Enable TLS
5. Copy the connection string (starts with `rediss://`)

#### Supabase PostgreSQL (Alternative)

1. Create project at [supabase.com](https://supabase.com)
2. Get connection string from Settings → Database
3. Use "Connection pooling" string for better performance

#### AWS S3 Setup

```bash
# Create S3 bucket
aws s3 mb s3://createlen-artifacts --region us-east-1

# Create IAM user with S3 access
aws iam create-user --user-name createlen-worker

# Attach S3 policy
aws iam attach-user-policy --user-name createlen-worker \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess

# Create access keys
aws iam create-access-key --user-name createlen-worker
```

### 2. Deploy to Render

#### Option A: Using render.yaml (Recommended)

1. Fork/clone this repository
2. Connect repository to Render
3. Render will automatically detect `render.yaml`
4. Set environment variables in Render dashboard for sensitive values:
   - `OPENAI_KEY`
   - `ALLOWED_TOKEN`
   - `S3_ACCESS_KEY_ID`
   - `S3_SECRET_ACCESS_KEY`
5. Create Redis instance manually (Render doesn't support Redis in YAML yet)
6. Deploy

#### Option B: Manual Setup

**Web Service:**
1. New → Web Service
2. Connect repository
3. Branch: `copilot/add-openai-scaffold`
4. Build Command: `npm ci`
5. Start Command: `npm start`
6. Health Check Path: `/health`
7. Add environment variables (see table above)

**Worker Service:**
1. New → Background Worker
2. Connect same repository
3. Branch: `copilot/add-openai-scaffold`
4. Build Command: `npm ci`
5. Start Command: `npm run worker`
6. Add environment variables (see table above)

**PostgreSQL:**
1. New → PostgreSQL
2. Name: `createlen-db`
3. Copy `DATABASE_URL` to both services

### 3. Run Database Migrations

After first deployment, run migrations:

```bash
# Using Render shell (in Web Service dashboard)
npm run migrate

# Or using local connection
DATABASE_URL="your-connection-string" npm run migrate
```

### 4. Verify Deployment

**Health Check:**
```bash
curl https://your-service.onrender.com/health
```

Expected response:
```json
{
  "ok": true,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.45,
  "services": {
    "database": "ok",
    "redis": "ok",
    "s3": "configured",
    "openai": "configured"
  }
}
```

## API Usage Examples

### Synchronous Generation (Legacy Mode)

```bash
curl -X POST https://your-service.onrender.com/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "brief": "Услуги корпоративного юриста для стартапов",
    "page_type": "invest",
    "sessionId": "test-session-1"
  }'
```

### Asynchronous Generation (New Mode)

**1. Submit job:**
```bash
curl -X POST https://your-service.onrender.com/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "brief": "Услуги корпоративного юриста для стартапов",
    "page_type": "invest",
    "sessionId": "test-session-1",
    "async": true
  }'
```

Response:
```json
{
  "sessionId": "test-session-1",
  "status": "pending",
  "message": "Job queued for processing"
}
```

**2. Check status:**
```bash
curl https://your-service.onrender.com/status/test-session-1 \
  -H "Authorization: Bearer your-token"
```

Response:
```json
{
  "sessionId": "test-session-1",
  "status": "completed",
  "data": { ... },
  "s3": {
    "jsonUrl": "https://...",
    "htmlUrl": "https://..."
  }
}
```

## Monitoring

### Logs

**Web Service Logs:**
```bash
# Via Render dashboard: Services → createlen-web → Logs
```

**Worker Logs:**
```bash
# Via Render dashboard: Services → createlen-worker → Logs
```

### BullMQ Dashboard (Optional)

Install and run Bull Board for queue monitoring:

```bash
npm install @bull-board/express @bull-board/api
```

## Troubleshooting

### Issue: Worker not processing jobs

**Check:**
1. Worker service is running (check Render dashboard)
2. Redis connection is valid (check logs)
3. `REDIS_URL` matches between web and worker
4. Worker has same environment variables as web service

**Debug:**
```bash
# In worker logs, you should see:
# [Worker] Landing generation worker started
# [Worker] Concurrency: 2
```

### Issue: Database connection fails

**Solutions:**
1. Verify `DATABASE_URL` is correct
2. For Supabase: use connection pooling string
3. Check if database allows connections from Render IPs
4. Run migrations: `npm run migrate`

### Issue: S3 upload fails

**Check:**
1. S3 credentials are correct
2. Bucket exists and is accessible
3. IAM user has S3 write permissions
4. Region matches bucket region

### Issue: Health check fails

**Common causes:**
1. Database not responding → check DATABASE_URL
2. Redis not responding → check REDIS_URL
3. Service still starting up → wait 1-2 minutes

## Scaling

### Horizontal Scaling

**Web Service:**
- Increase instance count in Render dashboard
- Each instance can handle ~100 req/sec

**Worker Service:**
- Increase instance count for more throughput
- Each worker processes jobs concurrently based on `WORKER_CONCURRENCY`

### Vertical Scaling

Upgrade Render plans:
- Starter → Standard → Pro
- More CPU/RAM for faster job processing

### Queue Tuning

Adjust worker concurrency:
```bash
WORKER_CONCURRENCY=5  # Process 5 jobs simultaneously
```

## Cost Optimization

**Development:**
- Use Render free tier for web service
- Upstash Redis free tier (10K commands/day)
- Supabase free tier (500MB database)
- S3: ~$0.023/GB/month

**Production:**
- Render Starter ($7/month per service)
- Upstash Pro ($10/month for 1M commands)
- Supabase Pro ($25/month for 8GB)
- S3: Pay per use

## Security Best Practices

1. **Never commit secrets** - Use Render environment variables
2. **Use TLS** - Enable for Redis (rediss://) and PostgreSQL
3. **Rotate keys** - Regularly update API keys and tokens
4. **Restrict CORS** - Add CORS middleware if needed
5. **Rate limiting** - Add rate limiting middleware for production
6. **IP allowlisting** - Configure for database if possible

## Support

For issues:
1. Check logs in Render dashboard
2. Verify all environment variables are set
3. Test health endpoint: `/health`
4. Review this guide for common issues

## Next Steps

- Set up monitoring with Render metrics
- Add custom domain in Render dashboard
- Configure automatic deployments
- Set up staging environment
- Add error tracking (e.g., Sentry)
