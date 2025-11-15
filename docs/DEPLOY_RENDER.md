# Deploying Createlen to Render

This guide explains how to deploy the Createlen autonomous landing generator to Render with async task processing.

## Architecture

- **Web Service**: Express.js API server (handles HTTP requests)
- **Worker Service**: BullMQ worker (processes async generation tasks)
- **Database**: Supabase Postgres (session storage)
- **Queue**: Upstash Redis (task queue)
- **Storage**: AWS S3 (artifact storage)

## Prerequisites

1. **Render Account**: Sign up at [render.com](https://render.com)
2. **Supabase Account**: Create a free Postgres database at [supabase.com](https://supabase.com)
3. **Upstash Account**: Create a free Redis database at [upstash.com](https://upstash.com)
4. **AWS Account**: Set up an S3 bucket and IAM credentials
5. **OpenAI API Key**: Get from [platform.openai.com](https://platform.openai.com)

## Step 1: Create Services on Render

### Option A: Using render.yaml (Recommended)

1. Connect your GitHub repository to Render
2. Create a new Blueprint instance
3. Point to the `render.yaml` file in your repository
4. Render will automatically create both web and worker services

### Option B: Manual Setup

#### Create Web Service
1. Go to Render Dashboard → New → Web Service
2. Connect your repository
3. Configure:
   - **Name**: `createlen-web`
   - **Environment**: `Node`
   - **Branch**: `copilot/add-openai-scaffold`
   - **Build Command**: `npm ci`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/health`

#### Create Worker Service
1. Go to Render Dashboard → New → Background Worker
2. Connect your repository
3. Configure:
   - **Name**: `createlen-worker`
   - **Environment**: `Node`
   - **Branch**: `copilot/add-openai-scaffold`
   - **Build Command**: `npm ci`
   - **Start Command**: `npm run worker`

## Step 2: Configure Environment Variables

Add these environment variables to **both** services:

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENAI_KEY` | OpenAI API key (or use OPENAI_API_KEY) | `sk-...` |
| `DATABASE_URL` | Supabase Postgres connection string | `postgresql://user:pass@host:5432/db` |
| `REDIS_URL` | Upstash Redis connection string | `rediss://default:pass@host:port` |
| `S3_BUCKET` | AWS S3 bucket name | `createlen-artifacts` |
| `S3_ACCESS_KEY_ID` | AWS IAM access key | `AKIA...` |
| `S3_SECRET_ACCESS_KEY` | AWS IAM secret key | `secret...` |
| `S3_REGION` | AWS region | `us-east-1` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ALLOWED_TOKEN` | API authentication token | (none) |
| `NODE_ENV` | Environment | `production` |
| `RENDER_API_KEY` | Render API key (for webhooks) | (none) |
| `RENDER_SERVICE_ID` | Service ID | (none) |

**Note**: Use either `OPENAI_KEY` or `OPENAI_API_KEY` - the code checks both for compatibility.

## Step 3: Set Up Infrastructure

### Supabase (Postgres)

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings → Database
3. Copy the connection string (URI format)
4. Run migrations:
   ```bash
   psql "$DATABASE_URL" < scripts/migrate.sql
   ```
   Or use Supabase SQL Editor to execute `scripts/migrate.sql`

### Upstash (Redis)

1. Create a new database at [console.upstash.com](https://console.upstash.com)
2. Choose region closest to your Render region
3. Enable TLS
4. Copy the connection string (starts with `rediss://`)

### AWS S3

1. Create a new S3 bucket in [AWS Console](https://console.aws.amazon.com/s3)
2. Create an IAM user with programmatic access
3. Attach policy:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:GetObject",
           "s3:DeleteObject"
         ],
         "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
       }
     ]
   }
   ```
4. Copy Access Key ID and Secret Access Key

## Step 4: Deploy

1. Push your code to the `copilot/add-openai-scaffold` branch
2. Render will automatically build and deploy both services
3. Check the logs for any errors
4. Verify health check: `https://your-service.onrender.com/health`

## Step 5: Run Database Migrations

After first deployment, run migrations:

```bash
# Using psql
psql "$DATABASE_URL" < scripts/migrate.sql

# Or via Render shell
# 1. Open web service dashboard
# 2. Click "Shell"
# 3. Run: node -e "import('./server/db.js').then(m => m.initMigrations())"
```

## Testing the Deployment

### Test Sync Generation
```bash
curl -X POST https://your-service.onrender.com/generate \
  -H "Content-Type: application/json" \
  -d '{
    "brief": "Юридические услуги для стартапов",
    "page_type": "invest",
    "token": "your-token-if-set"
  }'
```

### Test Async Generation
```bash
curl -X POST https://your-service.onrender.com/generate \
  -H "Content-Type: application/json" \
  -d '{
    "brief": "Юридические услуги для стартапов",
    "page_type": "invest",
    "async": true,
    "sessionId": "test-123",
    "token": "your-token-if-set"
  }'

# Check status
curl https://your-service.onrender.com/status/test-123
```

## Monitoring

- **Render Dashboard**: Monitor service health, logs, and metrics
- **Upstash Console**: Monitor Redis queue depth and operations
- **Supabase Dashboard**: Monitor database queries and connections
- **AWS CloudWatch**: Monitor S3 operations (optional)

## Troubleshooting

### Service Won't Start
- Check environment variables are set correctly
- Review logs in Render dashboard
- Verify DATABASE_URL and REDIS_URL are accessible

### Worker Not Processing Jobs
- Check worker logs for errors
- Verify REDIS_URL matches between web and worker
- Check Redis connection in Upstash console

### Database Connection Issues
- Verify Supabase project is not paused
- Check DATABASE_URL format
- Ensure SSL is enabled for production

### S3 Upload Failures
- Verify IAM credentials and permissions
- Check bucket name and region
- Ensure bucket is not blocking public access (if needed)

## Cost Optimization

### Free Tier Limits
- **Render**: 750 hours/month free for web services
- **Supabase**: 500MB database, 1GB bandwidth
- **Upstash**: 10,000 requests/day
- **AWS S3**: 5GB storage, 20,000 GET requests/month

### Tips
1. Use Render's free tier for testing
2. Set up auto-sleep for inactive services
3. Configure job cleanup in BullMQ (already set in queue.js)
4. Set up database cleanup for old sessions
5. Use S3 lifecycle policies to delete old artifacts

## Scaling

When you need to scale:

1. **Increase Worker Concurrency**: Edit `worker/worker.js` → `concurrency`
2. **Add More Workers**: Duplicate worker service in Render
3. **Upgrade Database**: Move to paid Supabase plan
4. **Upgrade Redis**: Move to paid Upstash plan
5. **Enable CDN**: Use CloudFlare for S3 objects

## Security Checklist

- [ ] All secrets are in environment variables (not in code)
- [ ] ALLOWED_TOKEN is set and strong
- [ ] Database has SSL enabled
- [ ] Redis has TLS enabled
- [ ] S3 bucket has appropriate access policies
- [ ] Render services are using HTTPS
- [ ] API rate limiting is configured (TODO)

## Next Steps

1. Set up monitoring and alerts
2. Add custom domain
3. Configure CI/CD for automatic deployments
4. Add observability (metrics, tracing)
5. Implement rate limiting
6. Add authentication/authorization
7. Set up backups for database
