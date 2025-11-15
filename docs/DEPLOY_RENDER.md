# Deploying to Render.com

This guide covers deploying Createlen with autonomous landing generation to Render.com, including web service and background worker setup.

## Prerequisites

Before deploying, you'll need to set up the following external services:

### 1. PostgreSQL Database (Supabase)

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Project Settings → Database
4. Copy the "Connection string" (URI format)
5. Save this as `DATABASE_URL` for Render

Example: `postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`

### 2. Redis Queue (Upstash)

1. Create a free account at [upstash.com](https://upstash.com)
2. Create a new Redis database
3. Copy the connection string (use the one compatible with ioredis)
4. Save this as `REDIS_URL` for Render

Example: `rediss://default:[PASSWORD]@[ENDPOINT].upstash.io:6379`

### 3. AWS S3 Storage

1. Log in to AWS Console
2. Create a new S3 bucket (or use existing)
3. Create an IAM user with S3 access:
   - Go to IAM → Users → Add User
   - Select "Programmatic access"
   - Attach policy: `AmazonS3FullAccess` or create custom policy
4. Save credentials:
   - `S3_BUCKET`: your bucket name (e.g., `createlen-results`)
   - `S3_ACCESS_KEY_ID`: IAM access key
   - `S3_SECRET_ACCESS_KEY`: IAM secret key
   - `S3_REGION`: bucket region (e.g., `us-east-1`)

### 4. OpenAI API Key

1. Get your API key from [platform.openai.com](https://platform.openai.com/api-keys)
2. Save as `OPENAI_API_KEY` (or `OPENAI_KEY`)

## Deployment Steps

### Option 1: Deploy via Render Blueprint (Recommended)

1. Fork/clone this repository to your GitHub account
2. Go to [Render Dashboard](https://dashboard.render.com)
3. Click "New" → "Blueprint"
4. Connect your GitHub repository
5. Select the branch: `copilot/add-openai-scaffold`
6. Render will detect `render.yaml` automatically
7. Configure environment variables (see below)
8. Click "Apply" to create services

### Option 2: Manual Service Creation

#### Web Service

1. In Render Dashboard, click "New" → "Web Service"
2. Connect your repository
3. Configure:
   - **Name**: `createlen-web`
   - **Environment**: `Node`
   - **Branch**: `copilot/add-openai-scaffold`
   - **Build Command**: `npm ci`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/health`
4. Add environment variables (see below)
5. Deploy

#### Worker Service

1. Click "New" → "Background Worker"
2. Connect the same repository
3. Configure:
   - **Name**: `createlen-worker`
   - **Environment**: `Node`
   - **Branch**: `copilot/add-openai-scaffold`
   - **Build Command**: `npm ci`
   - **Start Command**: `npm run worker`
4. Add the same environment variables
5. Deploy

## Environment Variables

Configure these in Render Dashboard for both web and worker services:

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-proj-...` |
| `OPENAI_KEY` | Alias for OpenAI key | `sk-proj-...` |
| `ALLOWED_TOKEN` | API authentication token | `your-secret-token-123` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `REDIS_URL` | Redis connection string | `rediss://default:pass@host:6379` |
| `S3_BUCKET` | S3 bucket name | `createlen-results` |
| `S3_ACCESS_KEY_ID` | AWS access key | `AKIAIOSFODNN7EXAMPLE` |
| `S3_SECRET_ACCESS_KEY` | AWS secret key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `S3_REGION` | S3 bucket region | `us-east-1` |

**Important:** Mark all sensitive variables as secret in Render.

## Running Database Migrations

After the web service is deployed:

1. Go to Render Dashboard → Your Web Service
2. Click "Shell" tab to open a shell
3. Run the migration command:
   ```bash
   npm run migrate
   ```
4. You should see: `✓ Database migrations completed successfully`

Alternative: Use Render's manual command feature:
1. Go to your service → "Manual Deploy" → "Shell"
2. Enter command: `npm run migrate`

## Health Checks

Render automatically monitors the `/health` endpoint:
- URL: `https://your-service.onrender.com/health`
- Expected response: `{"status":"ok","timestamp":"...","uptime":123}`

If health checks fail:
1. Check service logs in Render Dashboard
2. Verify environment variables are set correctly
3. Test database/Redis connectivity

## Testing the Deployment

### Synchronous Generation (existing behavior)
```bash
curl -X POST https://your-service.onrender.com/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ALLOWED_TOKEN" \
  -d '{
    "brief": "Юридические услуги по банкротству",
    "page_type": "invest",
    "token": "YOUR_ALLOWED_TOKEN"
  }'
```

### Asynchronous Generation (new autonomous mode)
```bash
# Step 1: Submit generation request
curl -X POST https://your-service.onrender.com/generate \
  -H "Content-Type: application/json" \
  -d '{
    "brief": "Юридические услуги по банкротству",
    "page_type": "invest",
    "token": "YOUR_ALLOWED_TOKEN",
    "async": true,
    "sessionId": "test-session-123"
  }'

# Response: {"sessionId":"test-session-123","status":"pending"}

# Step 2: Check status
curl https://your-service.onrender.com/status/test-session-123?token=YOUR_ALLOWED_TOKEN

# Response when completed:
# {
#   "sessionId": "test-session-123",
#   "status": "completed",
#   "resultUrl": "https://s3.amazonaws.com/..."
# }
```

## Monitoring

### Logs
- **Web Service Logs**: Render Dashboard → Web Service → Logs
- **Worker Logs**: Render Dashboard → Worker → Logs

### Metrics
- Monitor job processing in worker logs
- Check Redis queue metrics in Upstash dashboard
- Monitor S3 storage usage in AWS Console
- Track database usage in Supabase dashboard

## Troubleshooting

### Worker not processing jobs
1. Check worker logs for errors
2. Verify `REDIS_URL` is correctly configured
3. Ensure worker service is running (not crashed)
4. Test Redis connectivity: Connect to shell and run `node -e "import('ioredis').then(m=>new m.default(process.env.REDIS_URL).ping().then(console.log))"`

### Database connection errors
1. Verify `DATABASE_URL` format
2. Check Supabase project is active
3. Ensure IP restrictions allow Render's IPs
4. Test connection: `node -e "import('pg').then(m=>{const c=new m.default.Client({connectionString:process.env.DATABASE_URL});c.connect().then(()=>console.log('OK'))})"` 

### S3 upload failures
1. Verify S3 bucket exists and is accessible
2. Check IAM user has write permissions
3. Verify region matches bucket region
4. Check bucket CORS settings if accessing from browser

### OpenAI API errors
1. Verify API key is valid
2. Check OpenAI account has credits
3. Monitor rate limits
4. Review error messages in logs

## Scaling

### Vertical Scaling
- Upgrade Render plan for more CPU/memory
- Upgrade Supabase plan for more database connections
- Upgrade Upstash plan for higher Redis memory

### Horizontal Scaling
- Increase worker concurrency in `worker/worker.js`
- Deploy multiple worker instances
- Use Render autoscaling features

## Cost Estimates

### Free Tier (Development)
- Render: Free for 1 web service + 1 worker (with limitations)
- Supabase: Free tier (500MB database, 2GB bandwidth)
- Upstash: Free tier (10,000 commands/day)
- AWS S3: ~$0.023/GB/month storage + transfer costs

### Production (Starter)
- Render: ~$7/month per service ($14 for web + worker)
- Supabase: ~$25/month (Pro plan)
- Upstash: ~$10/month (Pay-as-you-go)
- AWS S3: Variable based on usage

## Security Best Practices

1. **Never commit secrets** to the repository
2. **Use environment variables** for all sensitive data
3. **Rotate credentials** regularly
4. **Enable HTTPS only** (Render provides this by default)
5. **Implement rate limiting** on API endpoints
6. **Monitor logs** for suspicious activity
7. **Use strong tokens** for `ALLOWED_TOKEN`
8. **Restrict S3 bucket access** to necessary IPs/users
9. **Enable database SSL** (Supabase provides this by default)

## Next Steps

After deployment:
1. Set up monitoring alerts
2. Configure backup strategy for database
3. Implement proper error tracking (e.g., Sentry)
4. Add request logging and analytics
5. Set up CI/CD pipeline for automated deployments
6. Document API endpoints for team members
7. Create runbooks for common issues

## Support

For issues specific to:
- **Render**: [render.com/docs](https://render.com/docs)
- **Supabase**: [supabase.com/docs](https://supabase.com/docs)
- **Upstash**: [docs.upstash.com](https://docs.upstash.com)
- **AWS S3**: [aws.amazon.com/s3/getting-started](https://aws.amazon.com/s3/getting-started/)
