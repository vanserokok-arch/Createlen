# Deployment Guide for Render.com

This guide provides step-by-step instructions for deploying the Createlen autonomous landing page generation system on Render.com.

## Architecture Overview

The system consists of:
- **Web Service**: Express.js API server handling HTTP requests
- **Worker Service**: Background job processor using BullMQ
- **PostgreSQL Database**: Stores session data and job status
- **Redis**: Job queue management
- **S3**: Artifact storage for generated HTML/JSON files

## Prerequisites

1. **Render.com Account**: Sign up at [render.com](https://render.com)
2. **AWS Account**: For S3 storage (or use S3-compatible service)
3. **OpenAI API Key**: Get from [platform.openai.com](https://platform.openai.com)
4. **GitHub Repository**: Forked or cloned version of this repo

## Step 1: Prepare S3 Bucket

1. Create an S3 bucket in AWS console
2. Note the bucket name, region, access key ID, and secret access key
3. Set bucket policy to allow public read (optional, for direct file access):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
    }
  ]
}
```

## Step 2: Deploy via Render Blueprint

### Option A: Using render.yaml (Recommended)

1. Push the `render.yaml` file to your repository on the `copilot/add-openai-scaffold` branch
2. Go to [Render Dashboard](https://dashboard.render.com)
3. Click **New** → **Blueprint**
4. Connect your GitHub repository
5. Select the `copilot/add-openai-scaffold` branch
6. Render will automatically create all services defined in `render.yaml`

### Option B: Manual Service Creation

If you prefer to create services manually:

#### Create PostgreSQL Database
1. Click **New** → **PostgreSQL**
2. Name: `createlen-db`
3. Database: `createlen`
4. User: `createlen`
5. Region: Choose closest to your users
6. Plan: Starter (free tier available)
7. Click **Create Database**
8. Note the **Internal Database URL** from the database dashboard

#### Create Redis Instance
1. Click **New** → **Redis**
2. Name: `createlen-redis`
3. Region: Same as PostgreSQL
4. Plan: Starter (free tier available)
5. Maxmemory Policy: `noeviction` (recommended for job queues)
6. Click **Create Redis**
7. Note the **Internal Redis URL**

#### Create Web Service
1. Click **New** → **Web Service**
2. Connect your GitHub repository
3. Name: `createlen-web`
4. Region: Same as database and Redis
5. Branch: `copilot/add-openai-scaffold`
6. Root Directory: (leave empty)
7. Environment: `Node`
8. Build Command: `npm install`
9. Start Command: `node server.js`
10. Plan: Starter (free tier available)
11. Advanced → Health Check Path: `/health`

#### Create Worker Service
1. Click **New** → Background Worker
2. Connect your GitHub repository
3. Name: `createlen-worker`
4. Region: Same as other services
5. Branch: `copilot/add-openai-scaffold`
6. Root Directory: (leave empty)
7. Environment: `Node`
8. Build Command: `npm install`
9. Start Command: `node worker/worker.js`
10. Plan: Starter

## Step 3: Configure Environment Variables

### For Web Service (`createlen-web`)

Add these environment variables in the Render dashboard:

| Variable Name | Value | Required | Notes |
|--------------|-------|----------|-------|
| `NODE_ENV` | `production` | Yes | |
| `PORT` | `3000` | Yes | Default port |
| `OPENAI_KEY` | `sk-...` | Yes | Your OpenAI API key |
| `ALLOWED_TOKEN` | `your-secret-token` | Yes | Authentication token for API |
| `S3_BUCKET` | `your-bucket-name` | Yes | S3 bucket name |
| `S3_ACCESS_KEY_ID` | `AKIA...` | Yes | AWS access key |
| `S3_SECRET_ACCESS_KEY` | `...` | Yes | AWS secret key |
| `S3_REGION` | `us-east-1` | Yes | S3 bucket region |
| `DATABASE_URL` | Auto-filled from DB | Yes | Internal database connection string |
| `REDIS_URL` | Auto-filled from Redis | Yes | Internal Redis connection string |

**Note**: `DATABASE_URL` and `REDIS_URL` can be auto-populated by linking the database and Redis services in Render.

### For Worker Service (`createlen-worker`)

Add the same environment variables as the Web Service.

## Step 4: Run Database Migration

After the PostgreSQL database is created:

1. Open a shell to your Web service or use `psql` locally
2. Get the **External Database URL** from the Render PostgreSQL dashboard
3. Run the migration:

```bash
psql "postgresql://USER:PASSWORD@HOST/DATABASE" < scripts/migrate.sql
```

Or using the internal connection from a Render Shell:

```bash
psql $DATABASE_URL < scripts/migrate.sql
```

**Verify migration**:
```bash
psql $DATABASE_URL -c "\d sessions"
```

## Step 5: Deploy and Test

1. Both services should automatically deploy after configuration
2. Monitor logs in the Render dashboard
3. Wait for successful deployment (look for "Worker started" in worker logs)

### Test the Health Endpoint

```bash
curl https://your-service.onrender.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T12:00:00.000Z",
  "uptime": 123.45,
  "dependencies": {
    "database": {"status": "healthy"},
    "queue": {"status": "healthy"},
    "s3": {"status": "configured"},
    "openai": {"status": "configured"}
  }
}
```

### Test Autonomous Generation

Create a new landing page generation job:

```bash
curl -X POST https://your-service.onrender.com/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ALLOWED_TOKEN" \
  -d '{
    "brief": "Юридическая помощь по инвестиционным спорам в России",
    "page_type": "invest",
    "sessionId": "test-session-1"
  }'
```

### Check Job Status

Query the database to check job status:

```bash
psql $DATABASE_URL -c "SELECT session_id, status, created_at FROM sessions ORDER BY created_at DESC LIMIT 5;"
```

Or create a status endpoint in your API (TODO).

## Step 6: Monitor and Scale

### View Logs
- Web Service logs: Monitor API requests and errors
- Worker logs: Monitor job processing and OpenAI calls

### Scaling
- **Web Service**: Increase instance count for more concurrent requests
- **Worker Service**: Increase instance count for parallel job processing
- **Redis**: Upgrade plan for more memory
- **PostgreSQL**: Upgrade plan for more storage/connections

### Recommended Monitoring
- Set up alerts for failed jobs
- Monitor OpenAI API usage and costs
- Track S3 storage growth
- Monitor database connection pool usage

## Troubleshooting

### "Database not configured" in health check
- Verify `DATABASE_URL` is set correctly
- Check database is running and accessible
- Verify migration was run successfully

### "Queue not configured" in health check
- Verify `REDIS_URL` is set correctly
- Check Redis instance is running
- Verify Redis password is correct (if applicable)

### Worker not processing jobs
- Check worker logs for errors
- Verify worker service is running
- Check Redis connection from worker
- Verify `OPENAI_KEY` is set

### S3 upload failures
- Verify S3 credentials are correct
- Check bucket exists and is accessible
- Verify bucket region matches `S3_REGION`
- Check IAM permissions for PutObject

### OpenAI API errors
- Verify API key is valid and active
- Check OpenAI API status
- Monitor rate limits and quota
- Check billing status

## Security Best Practices

1. **Never commit secrets**: Use Render environment variables
2. **Rotate keys regularly**: Update OpenAI and AWS keys periodically
3. **Use IAM least privilege**: S3 user should only have PutObject/GetObject
4. **Enable HTTPS**: Render provides this by default
5. **Validate input**: Ensure brief length limits are enforced
6. **Rate limiting**: Consider adding rate limiting to API endpoints
7. **Monitor costs**: Set up AWS billing alerts and OpenAI usage alerts

## Cost Estimation

### Free Tier (for testing)
- Render Web Service: 750 hours/month
- Render Worker: 750 hours/month
- PostgreSQL: Starter plan (free)
- Redis: Starter plan (free)
- S3: 5GB storage, 20,000 GET requests, 2,000 PUT requests (AWS free tier)
- OpenAI: Pay per token (monitor usage)

### Production (estimated monthly)
- Render Web Service: $7-25/month
- Render Worker: $7-25/month
- PostgreSQL: $7-50/month
- Redis: $5-20/month
- S3: ~$1-10/month (depends on storage and requests)
- OpenAI: Variable (depends on usage)

**Total estimated cost**: $27-130/month + OpenAI usage

## Next Steps

1. Set up monitoring and alerting
2. Implement retry logic for failed jobs
3. Add job status API endpoint
4. Implement webhook notifications
5. Add admin dashboard for job management
6. Set up automated backups for PostgreSQL
7. Implement job cleanup for old completed jobs

## Support

For issues or questions:
- Check Render documentation: https://render.com/docs
- OpenAI documentation: https://platform.openai.com/docs
- AWS S3 documentation: https://docs.aws.amazon.com/s3/

---

Last updated: 2024-01-15
