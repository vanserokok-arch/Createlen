# Deployment Instructions for Render

This document provides step-by-step instructions for deploying the Createlen autonomous landing generation system on Render.

## Prerequisites

Before deploying, ensure you have:

1. **AWS S3 Bucket** for file storage
   - Create a bucket in AWS S3
   - Create IAM user with S3 access
   - Note: Access Key ID, Secret Access Key, Bucket Name, and Region

2. **Supabase PostgreSQL Database**
   - Sign up at [supabase.com](https://supabase.com)
   - Create a new project
   - Get the connection string from Settings → Database → Connection String (Direct Connection)
   - Format: `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`

3. **Upstash Redis**
   - Sign up at [upstash.com](https://upstash.com)
   - Create a new Redis database
   - Copy the Redis URL (format: `rediss://...`)

4. **OpenAI API Key**
   - Get API key from [platform.openai.com](https://platform.openai.com)

## Environment Variables

Configure the following environment variables in Render dashboard for both web service and worker:

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENAI_KEY` | OpenAI API key (primary) | `sk-...` |
| `OPENAI_API_KEY` | OpenAI API key (fallback for compatibility) | `sk-...` |
| `ALLOWED_TOKEN` | Authentication token for API access | `your-secret-token-123` |
| `DATABASE_URL` | PostgreSQL connection string from Supabase | `postgresql://postgres:...` |
| `REDIS_URL` | Redis connection string from Upstash | `rediss://default:...` |
| `S3_BUCKET` | AWS S3 bucket name | `my-landing-bucket` |
| `S3_ACCESS_KEY_ID` | AWS IAM access key ID | `AKIA...` |
| `S3_SECRET_ACCESS_KEY` | AWS IAM secret access key | `...` |
| `S3_REGION` | AWS region | `us-east-1` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port (auto-set by Render) | `3000` |
| `API_URL` | Internal API URL for worker | `http://localhost:3000` |
| `RENDER_API_KEY` | Render API key for integrations | - |
| `RENDER_SERVICE_ID` | Current service ID | - |

## Deployment Steps

### Option 1: Using render.yaml (Recommended)

1. **Push Code to GitHub**
   ```bash
   git push origin copilot/autonomous-skeleton
   ```

2. **Connect Repository to Render**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New" → "Blueprint"
   - Connect your GitHub repository
   - Select branch: `copilot/add-openai-scaffold`
   - Render will automatically detect `render.yaml`

3. **Configure Environment Variables**
   - In Render dashboard, go to each service (web and worker)
   - Navigate to "Environment" tab
   - Add all required environment variables listed above
   - Click "Save Changes"

4. **Run Database Migration**
   - Option A: Use Render shell
     ```bash
     psql "$DATABASE_URL" -f scripts/migrate.sql
     ```
   
   - Option B: Run locally with Supabase connection
     ```bash
     # Install PostgreSQL client if needed
     psql "postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres" -f scripts/migrate.sql
     ```
   
   - Option C: Use Supabase SQL Editor
     - Copy contents of `scripts/migrate.sql`
     - Paste into Supabase SQL Editor
     - Run the query

5. **Deploy Services**
   - Render will automatically build and deploy both services
   - Monitor deployment logs for any errors
   - Wait for services to become "Live"

### Option 2: Manual Setup

1. **Create Web Service**
   - Go to Render Dashboard → New → Web Service
   - Connect repository and select branch
   - Configure:
     - Name: `createlen-web`
     - Runtime: `Node`
     - Build Command: `npm ci`
     - Start Command: `npm start`
     - Plan: Free (or upgrade as needed)
   - Add environment variables
   - Deploy

2. **Create Worker Service**
   - Go to Render Dashboard → New → Background Worker
   - Connect repository and select branch
   - Configure:
     - Name: `createlen-worker`
     - Runtime: `Node`
     - Build Command: `npm ci`
     - Start Command: `node worker/worker.js`
     - Plan: Free (or upgrade as needed)
   - Add environment variables
   - Deploy

3. **Run Migrations** (same as Option 1, step 4)

## Health Check Configuration

Render automatically monitors the `/health` endpoint:
- Path: `/health`
- Expected Status: `200 OK`
- Check Interval: Every 30 seconds

For more detailed health information, visit:
- `/health/detailed` - Full system status
- `/health/ready` - Readiness check
- `/health/live` - Liveness check

## Testing the Deployment

### 1. Test Synchronous Generation

```bash
curl -X POST https://createlen-web.onrender.com/generate \
  -H "Content-Type: application/json" \
  -d '{
    "brief": "Юридическая помощь по банкротству физических лиц",
    "page_type": "invest",
    "token": "your-secret-token-123",
    "sessionId": "test-sync-1"
  }'
```

### 2. Test Asynchronous Generation

```bash
# Start async generation
curl -X POST https://createlen-web.onrender.com/generate \
  -H "Content-Type: application/json" \
  -d '{
    "brief": "Юридическая помощь по банкротству физических лиц",
    "page_type": "invest",
    "token": "your-secret-token-123",
    "sessionId": "test-async-1",
    "async": true
  }'

# Response: {"sessionId": "test-async-1", "status": "queued"}

# Check status (after 10-30 seconds)
curl https://createlen-web.onrender.com/api/sessions/test-async-1?token=your-secret-token-123
```

### 3. Test Health Endpoint

```bash
curl https://createlen-web.onrender.com/health

# Detailed health check
curl https://createlen-web.onrender.com/health/detailed
```

## Monitoring and Logs

### View Logs in Render

1. Go to your service in Render Dashboard
2. Click on "Logs" tab
3. Monitor real-time logs for both web service and worker

### Common Log Patterns

- ✅ Success: `Job [id] completed successfully`
- ❌ Error: `Job [id] failed with error:`
- ⚠️ Warning: `Internal API call failed, using direct OpenAI call`

## Troubleshooting

### Worker Not Processing Jobs

**Symptoms:**
- Jobs stuck in "queued" status
- Worker logs show no activity

**Solutions:**
1. Check Redis connection:
   ```bash
   # Verify REDIS_URL is set correctly
   echo $REDIS_URL
   ```
2. Restart worker service in Render
3. Check worker logs for connection errors

### Database Connection Errors

**Symptoms:**
- `DATABASE_URL not configured`
- Connection timeout errors

**Solutions:**
1. Verify Supabase database is active
2. Check DATABASE_URL format (should include SSL parameters)
3. Ensure IP is whitelisted in Supabase (usually not needed)
4. Test connection manually:
   ```bash
   psql "$DATABASE_URL" -c "SELECT NOW();"
   ```

### S3 Upload Failures

**Symptoms:**
- `Failed to upload to S3`
- Permission denied errors

**Solutions:**
1. Verify IAM user has S3 permissions:
   - `s3:PutObject`
   - `s3:GetObject`
2. Check bucket exists and region is correct
3. Verify credentials are not expired

### OpenAI API Errors

**Symptoms:**
- `LLM returned non-JSON`
- Rate limit errors
- Invalid API key

**Solutions:**
1. Verify OPENAI_KEY is set correctly
2. Check OpenAI account has credits
3. Monitor rate limits at platform.openai.com
4. Consider upgrading to paid tier for higher limits

## Scaling Considerations

### Free Tier Limitations

- Web Service: Sleeps after 15 minutes of inactivity
- Worker: Sleeps after 15 minutes of inactivity
- Redis (Upstash): 10,000 commands/day on free tier
- Supabase: 500MB database, 2GB bandwidth

### Upgrading for Production

1. **Render Services**: Upgrade to Starter or Standard plan
   - No sleep mode
   - More resources
   - Better performance

2. **Redis**: Upgrade Upstash plan for more commands

3. **Database**: Upgrade Supabase plan for more storage

4. **S3**: Monitor costs, enable lifecycle policies for old files

## Security Best Practices

1. **Rotate Secrets Regularly**
   - Change ALLOWED_TOKEN periodically
   - Rotate AWS credentials
   - Update OpenAI API keys

2. **Enable SSL/TLS**
   - Render automatically provides SSL certificates
   - Ensure all external connections use HTTPS/TLS

3. **Restrict Access**
   - Use ALLOWED_TOKEN for all API requests
   - Consider adding IP whitelisting
   - Implement rate limiting

4. **Monitor Usage**
   - Set up billing alerts in AWS, OpenAI
   - Monitor Render usage metrics
   - Track Redis command usage

## Cost Estimation (Free Tier)

- **Render Web Service**: Free (with sleep mode)
- **Render Worker**: Free (with sleep mode)
- **Supabase PostgreSQL**: Free (up to 500MB)
- **Upstash Redis**: Free (10k commands/day)
- **AWS S3**: ~$0.023/GB/month (first 5GB free for 12 months)
- **OpenAI API**: Pay-per-use (gpt-4o-mini: ~$0.15/1M input tokens)

**Estimated Monthly Cost (Low Usage):** $0-5

## Support and Resources

- [Render Documentation](https://render.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Upstash Documentation](https://docs.upstash.com)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [BullMQ Documentation](https://docs.bullmq.io)

---

**Last Updated:** 2025-11-15
**Branch:** copilot/autonomous-skeleton

**TODO for Production:**
- [ ] Set up custom domain
- [ ] Configure CDN for static assets
- [ ] Implement rate limiting
- [ ] Add monitoring/alerting (Sentry, DataDog)
- [ ] Set up automated backups
- [ ] Implement request logging
- [ ] Add API documentation (Swagger/OpenAPI)
