# Deploying Createlen to Render

This guide explains how to deploy the Createlen autonomous landing generator to Render.com with full async job processing support.

## Architecture Overview

The deployment consists of:
- **Web Service**: Express API server handling HTTP requests
- **Worker Service**: Background job processor using BullMQ
- **External Services**: PostgreSQL (Supabase), Redis (Upstash), S3 storage

## Prerequisites

1. **Render Account**: Sign up at [render.com](https://render.com)
2. **Supabase Account**: For PostgreSQL database ([supabase.com](https://supabase.com))
3. **Upstash Account**: For Redis queue ([upstash.com](https://upstash.com))
4. **AWS Account** or **Supabase Storage**: For file storage
5. **OpenAI API Key**: From [platform.openai.com](https://platform.openai.com)

## Step 1: Set Up External Services

### PostgreSQL (Supabase)

1. Create a new project in Supabase
2. Go to Settings > Database
3. Copy the connection string (URI format)
4. Format: `postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres`

### Redis (Upstash)

1. Create a new Redis database in Upstash
2. Select the region closest to your Render region
3. Copy the Redis URL (TLS format)
4. Format: `rediss://default:[PASSWORD]@[HOST]:6379`

### S3 Storage

**Option A: AWS S3**
1. Create an S3 bucket
2. Create an IAM user with S3 access
3. Generate access key and secret
4. Note: bucket name, access key, secret, region

**Option B: Supabase Storage**
1. Enable Storage in your Supabase project
2. Create a new bucket
3. Get S3-compatible credentials from Supabase dashboard
4. Use the S3 endpoint provided by Supabase

## Step 2: Deploy to Render

### Option A: Using render.yaml (Recommended)

1. Fork/clone this repository
2. Connect your GitHub repository to Render
3. Render will automatically detect `render.yaml`
4. Configure environment variables (see below)

### Option B: Manual Setup

#### Create Web Service

1. Click "New +" → "Web Service"
2. Connect your repository
3. Configure:
   - **Name**: `createlen-web`
   - **Region**: Choose closest to your users
   - **Branch**: `copilot/add-openai-scaffold`
   - **Build Command**: `npm ci`
   - **Start Command**: `npm start`
   - **Plan**: Starter ($7/month) or higher
   - **Health Check Path**: `/health`

#### Create Worker Service

1. Click "New +" → "Background Worker"
2. Connect your repository
3. Configure:
   - **Name**: `createlen-worker`
   - **Region**: Same as web service
   - **Branch**: `copilot/add-openai-scaffold`
   - **Build Command**: `npm ci`
   - **Start Command**: `node worker/worker.js`
   - **Plan**: Starter ($7/month) or higher

## Step 3: Configure Environment Variables

### Required Variables (Both Services)

Add these environment variables to **both** web and worker services:

```bash
# OpenAI Configuration
OPENAI_KEY=sk-...
# or
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Authentication
ALLOWED_TOKEN=your-secret-token-here

# Database
DATABASE_URL=postgresql://postgres:password@host:5432/postgres

# Queue
REDIS_URL=rediss://default:password@host:6379

# S3 Storage
S3_BUCKET=your-bucket-name
S3_ACCESS_KEY_ID=AKIA...
S3_SECRET_ACCESS_KEY=...
S3_REGION=us-east-1
# Optional: for Supabase Storage
S3_ENDPOINT=https://[project-ref].supabase.co/storage/v1/s3
```

### Optional Variables

```bash
# Render API (for programmatic worker management)
RENDER_API_KEY=rnd_...
RENDER_SERVICE_ID=srv-...

# Server Configuration
PORT=3000  # Render sets this automatically
NODE_ENV=production
```

### Web Service Only

```bash
# No additional variables needed
```

### Worker Service Only

```bash
# No additional variables needed
```

## Step 4: Run Database Migrations

After the web service is deployed:

1. Open the Render dashboard
2. Go to your web service
3. Click "Shell" to open a terminal
4. Run the migration:

```bash
node -e "import('./server/db.js').then(m => m.initMigrations())"
```

Or connect to your Supabase SQL editor and run `/scripts/migrate.sql` manually.

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
  "checks": {
    "database": { "status": "healthy" },
    "queue": { "status": "healthy" },
    "openai": { "status": "configured" },
    "s3": { "status": "configured" }
  }
}
```

### Test Synchronous Generation

```bash
curl -X POST https://your-service.onrender.com/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ALLOWED_TOKEN" \
  -d '{
    "brief": "Юридические услуги для стартапов",
    "page_type": "invest",
    "sessionId": "test-session-1"
  }'
```

### Test Asynchronous Generation

```bash
# Enqueue job
curl -X POST https://your-service.onrender.com/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ALLOWED_TOKEN" \
  -d '{
    "brief": "Помощь с регистрацией бизнеса",
    "page_type": "invest",
    "sessionId": "async-test-1",
    "async": true
  }'

# Check status (endpoint to be implemented)
curl https://your-service.onrender.com/status/async-test-1 \
  -H "Authorization: Bearer YOUR_ALLOWED_TOKEN"
```

## Monitoring

### Render Dashboard

- View logs for web and worker services
- Monitor CPU/memory usage
- Check deployment history
- View metrics and alerts

### Health Checks

- Web service: `/health` - Comprehensive health check
- Web service: `/health/live` - Liveness check
- Web service: `/health/ready` - Readiness check

### BullMQ Dashboard (Optional)

To monitor your queue, you can deploy Bull Board:

1. Add `@bull-board/express` to dependencies
2. Mount Bull Board in development/staging
3. Protect with authentication

## Troubleshooting

### Worker Not Processing Jobs

1. Check worker logs in Render dashboard
2. Verify `REDIS_URL` is correct and accessible
3. Ensure worker service is running
4. Check queue status via health endpoint

### Database Connection Issues

1. Verify `DATABASE_URL` format
2. Check Supabase connection pooler settings
3. Ensure SSL is properly configured
4. Test connection in Shell: `psql $DATABASE_URL -c "SELECT NOW()"`

### S3 Upload Failures

1. Verify bucket permissions (allow PutObject, GetObject)
2. Check IAM user/role permissions
3. Verify bucket region matches `S3_REGION`
4. For Supabase Storage, ensure S3_ENDPOINT is set

### OpenAI API Errors

1. Verify API key is valid
2. Check OpenAI account has credits
3. Review rate limits and quotas
4. Check model availability (gpt-4o-mini)

## Scaling

### Horizontal Scaling

- Increase worker instances for higher throughput
- Add more web service instances for increased traffic
- Use Render's autoscaling (Professional plans)

### Vertical Scaling

- Upgrade service plans for more CPU/memory
- Consider Render Pro plans for better performance

### Cost Optimization

- Use Render's free tier for development
- Scale down workers during low-traffic periods
- Use Upstash's serverless Redis for pay-per-use
- Implement S3 lifecycle policies for old files

## Security Best Practices

1. **Never commit secrets** to version control
2. Use Render's **Secret Files** for sensitive configs
3. Enable **HTTPS only** (enabled by default on Render)
4. Rotate **API keys** regularly
5. Use **IAM roles** with minimal permissions
6. Enable **Supabase Row Level Security (RLS)**
7. Implement **rate limiting** for public endpoints
8. Use **ALLOWED_TOKEN** for API authentication

## CI/CD Integration

Render automatically deploys on:
- Push to configured branch
- Manual deploy from dashboard
- API-triggered deploys

GitHub Actions can trigger deploys:
```yaml
- name: Trigger Render Deploy
  run: |
    curl -X POST "https://api.render.com/v1/services/${{ secrets.RENDER_SERVICE_ID }}/deploys" \
      -H "Authorization: Bearer ${{ secrets.RENDER_API_KEY }}"
```

## Backup and Recovery

### Database Backups

- Supabase provides automatic daily backups
- Manual backups: Use `pg_dump`
- Point-in-time recovery available (Pro plans)

### Redis Persistence

- Upstash provides automatic persistence
- Jobs are durable across restarts

### S3 Backups

- Enable S3 versioning
- Configure lifecycle policies
- Use cross-region replication for critical data

## Support

- Render Docs: https://render.com/docs
- Supabase Docs: https://supabase.com/docs
- Upstash Docs: https://upstash.com/docs
- BullMQ Docs: https://docs.bullmq.io

## Cost Estimate

Minimum monthly costs:
- Render Web Service: $7 (Starter)
- Render Worker: $7 (Starter)
- Supabase: Free tier (upgrade as needed)
- Upstash Redis: Free tier (pay-per-use)
- AWS S3: ~$1-5 (depending on usage)
- OpenAI API: Pay-per-use (~$0.15 per 1K tokens for gpt-4o-mini)

**Total**: ~$15-20/month + usage-based costs
