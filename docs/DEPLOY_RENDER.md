# Deploy to Render

This guide explains how to deploy Createlen with autonomous generation mode to Render.

## Prerequisites

1. **Render Account**: Sign up at https://render.com
2. **Supabase Account**: Sign up at https://supabase.com (for PostgreSQL)
3. **Upstash Account**: Sign up at https://upstash.com (for Redis)
4. **AWS Account**: For S3 storage (or use Supabase Storage as alternative)
5. **OpenAI API Key**: Get from https://platform.openai.com

## Infrastructure Setup

### 1. Supabase (PostgreSQL Database)

1. Create a new Supabase project
2. Go to Settings > Database
3. Copy the Connection String (URI format)
4. Save as `DATABASE_URL` for later use

Example: `postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres`

### 2. Upstash (Redis for BullMQ)

1. Create a new Redis database at https://console.upstash.com
2. Choose a region close to your Render deployment
3. Copy the Redis URL (TLS/SSL format)
4. Save as `REDIS_URL` for later use

Example: `rediss://default:[PASSWORD]@[HOST]:[PORT]`

### 3. AWS S3 (Storage)

1. Create an S3 bucket in AWS Console
2. Create an IAM user with S3 access
3. Generate Access Key and Secret Key
4. Save the following for later:
   - `S3_BUCKET`: Your bucket name
   - `S3_ACCESS_KEY_ID`: IAM user access key
   - `S3_SECRET_ACCESS_KEY`: IAM user secret key
   - `S3_REGION`: Bucket region (e.g., `us-east-1`)

**Alternative: Supabase Storage**
- Use Supabase Storage instead of S3 (requires code modifications)
- Follow Supabase Storage documentation

## Render Deployment

### Option 1: Using render.yaml (Recommended)

1. Fork/clone this repository
2. Connect your GitHub repository to Render
3. Create a new "Blueprint" deployment
4. Render will automatically detect `render.yaml`
5. Set environment variables in Render Dashboard (see below)

### Option 2: Manual Service Creation

#### Web Service

1. New Web Service
2. Connect your repository
3. Branch: `copilot/add-openai-scaffold`
4. Build Command: `npm ci`
5. Start Command: `node server.js`
6. Health Check Path: `/health`
7. Set environment variables (see below)

#### Worker Service

1. New Background Worker
2. Connect your repository
3. Branch: `copilot/add-openai-scaffold`
4. Build Command: `npm ci`
5. Start Command: `node worker/worker.js`
6. Set environment variables (see below)

## Environment Variables

Set these in Render Dashboard for **both** Web and Worker services:

### Required Variables

```bash
# OpenAI Configuration
OPENAI_KEY=sk-...                    # Your OpenAI API key (also supports OPENAI_API_KEY)

# Authentication
ALLOWED_TOKEN=your-secret-token      # Token for API authentication

# Database (Supabase)
DATABASE_URL=postgresql://...        # Supabase connection string

# Redis (Upstash)
REDIS_URL=rediss://...              # Upstash Redis URL (TLS format)

# S3 Storage
S3_BUCKET=your-bucket-name
S3_ACCESS_KEY_ID=AKIA...
S3_SECRET_ACCESS_KEY=...
S3_REGION=us-east-1

# Render Deployment (for CI/CD)
RENDER_API_KEY=rnd_...              # Get from Render Account Settings
RENDER_SERVICE_ID=srv-...           # Get from service URL
```

### Optional Variables

```bash
PORT=3000                           # Auto-set by Render
NODE_ENV=production                 # Auto-set by Render
```

## Database Migration

After deploying, run the migration to create the `sessions` table:

```bash
# Option 1: Using Supabase SQL Editor
# Go to Supabase Dashboard > SQL Editor
# Copy contents of scripts/migrate.sql and execute

# Option 2: Using psql command
psql "postgresql://..." < scripts/migrate.sql

# Option 3: Enable auto-migration in server.js
# Uncomment the initMigrations() call in server.js
```

## Health Checks

Render will automatically check the `/health` endpoint:

- **Healthy**: Returns 200 with service status
- **Degraded**: Returns 200 but shows connectivity issues
- **Down**: Returns 503

## Testing the Deployment

### 1. Sync Generation (existing behavior)

```bash
curl -X POST https://your-app.onrender.com/generate \
  -H "Content-Type: application/json" \
  -d '{
    "token": "your-secret-token",
    "brief": "Юридические услуги для стартапов",
    "page_type": "invest"
  }'
```

### 2. Async Generation (new autonomous mode)

```bash
# Enqueue generation task
curl -X POST https://your-app.onrender.com/generate \
  -H "Content-Type: application/json" \
  -d '{
    "token": "your-secret-token",
    "brief": "Юридические услуги для стартапов",
    "page_type": "invest",
    "async": true
  }'

# Response: { "sessionId": "session-1234567890", "status": "queued" }

# Check status
curl https://your-app.onrender.com/session/session-1234567890

# Response when completed:
# {
#   "sessionId": "session-1234567890",
#   "status": "completed",
#   "artifact_url": "https://bucket.s3.amazonaws.com/...",
#   "payload": { ... }
# }
```

## Monitoring

### Logs

- **Web Service**: View logs in Render Dashboard > Web Service > Logs
- **Worker Service**: View logs in Render Dashboard > Worker > Logs

### Queue Monitoring

Use Upstash Console to monitor:
- Queue depth
- Job processing rate
- Failed jobs

### Database Monitoring

Use Supabase Dashboard to monitor:
- Session records
- Query performance
- Storage usage

## Troubleshooting

### Worker Not Processing Jobs

1. Check REDIS_URL is correctly set
2. Verify worker logs for connection errors
3. Check Upstash Redis is accessible
4. Verify BullMQ queue name matches

### Database Connection Fails

1. Verify DATABASE_URL format
2. Check Supabase project is active
3. Ensure SSL is enabled (Supabase requires it)
4. Run migration script if tables don't exist

### S3 Upload Fails

1. Verify S3 credentials are correct
2. Check bucket permissions (IAM policy)
3. Verify bucket region matches S3_REGION
4. Check CORS configuration if accessing from browser

### Health Check Fails

1. Check application logs for errors
2. Verify all environment variables are set
3. Test connectivity to external services (DB, Redis, S3)
4. Increase health check timeout in Render settings

## Cost Optimization

### Render Free Tier

- Web service: Sleeps after 15 minutes of inactivity
- Worker: Not available on free tier (paid only)

### Upstash

- Free tier: 10,000 commands/day
- Upgrade for higher throughput

### Supabase

- Free tier: 500 MB database, 1 GB transfer
- Monitor usage in dashboard

### AWS S3

- First 5 GB free per month
- Set lifecycle policies to delete old artifacts

## Security Best Practices

1. **Never commit secrets**: Use environment variables
2. **Rotate API keys**: Regularly update OpenAI, AWS keys
3. **Use strong tokens**: Generate secure ALLOWED_TOKEN
4. **Enable SSL**: Always use HTTPS endpoints
5. **Monitor access**: Check Render and Supabase logs
6. **Set bucket policies**: Restrict S3 access to necessary operations

## CI/CD

The repository includes GitHub Actions workflow that:
1. Runs tests on every push/PR
2. Builds Docker image
3. Triggers Render deployment (if configured)

Set these secrets in GitHub:
- `RENDER_API_KEY`
- `RENDER_SERVICE_ID`

## Next Steps

- Set up monitoring and alerting
- Configure auto-scaling based on queue depth
- Implement rate limiting for OpenAI API
- Add job retry logic customization
- Set up backup strategy for database
- Configure CDN for S3 artifacts

## Support

- Render Docs: https://render.com/docs
- Supabase Docs: https://supabase.com/docs
- Upstash Docs: https://docs.upstash.com
- BullMQ Docs: https://docs.bullmq.io
