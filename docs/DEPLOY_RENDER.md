# Deploying to Render

This guide explains how to deploy Createlen to Render with web service and worker for autonomous landing generation.

## Architecture

- **Web Service**: Express API server handling HTTP requests
- **Worker Service**: BullMQ worker processing async generation tasks
- **Database**: Supabase (Postgres) for session storage
- **Queue**: Upstash Redis for task queue
- **Storage**: AWS S3 for artifact storage

## Prerequisites

1. **Render Account**: Sign up at [render.com](https://render.com)
2. **Supabase Account**: Create a project at [supabase.com](https://supabase.com)
3. **Upstash Account**: Create a Redis database at [upstash.com](https://upstash.com)
4. **AWS Account**: Set up S3 bucket and IAM credentials
5. **OpenAI API Key**: Get from [platform.openai.com](https://platform.openai.com)

## Environment Variables

Configure these in Render dashboard for both web and worker services:

### Required Variables

```bash
# OpenAI (use either OPENAI_KEY or OPENAI_API_KEY)
OPENAI_KEY=sk-...
OPENAI_API_KEY=sk-...

# Authentication
ALLOWED_TOKEN=your-secret-token

# Database (from Supabase)
DATABASE_URL=postgresql://user:password@host.supabase.co:5432/postgres

# Queue (from Upstash)
REDIS_URL=rediss://default:password@host.upstash.io:6379

# Storage (from AWS)
S3_BUCKET=your-bucket-name
S3_ACCESS_KEY_ID=AKIA...
S3_SECRET_ACCESS_KEY=...
S3_REGION=us-east-1

# Render (optional, for API access)
RENDER_API_KEY=...
RENDER_SERVICE_ID=...
```

## Setup Steps

### 1. Create Supabase Database

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Get connection string from Settings > Database > Connection string
3. Run migration manually or let the app run it on startup:

```bash
# Connect to your database
psql "postgresql://user:password@host.supabase.co:5432/postgres"

# Run migration
\i scripts/migrate.sql
```

Or copy contents of `scripts/migrate.sql` and execute in Supabase SQL Editor.

### 2. Create Upstash Redis

1. Go to [upstash.com](https://upstash.com) and create a new Redis database
2. Choose a region close to your Render region
3. Copy the connection URL (use TLS/SSL version)

### 3. Set Up AWS S3

1. Create an S3 bucket in AWS Console
2. Create IAM user with S3 permissions:
   - `s3:PutObject`
   - `s3:GetObject`
   - `s3:DeleteObject`
3. Generate access key and secret key
4. Configure bucket CORS if needed for browser access

**Alternative: Use Supabase Storage**

Instead of AWS S3, you can use Supabase Storage:
1. Enable Storage in Supabase dashboard
2. Create a bucket for landings
3. Modify `server/s3.js` to use Supabase Storage SDK

### 4. Deploy to Render

#### Option A: Using render.yaml (Recommended)

1. Push code to GitHub
2. Connect repository to Render
3. Render will auto-detect `render.yaml` and create services
4. Add environment variables in Render dashboard
5. Deploy!

#### Option B: Manual Setup

1. **Create Web Service**:
   - Name: `createlen-web`
   - Runtime: Node
   - Build Command: `npm ci`
   - Start Command: `npm start`
   - Branch: `copilot/add-openai-scaffold`
   - Health Check Path: `/health`

2. **Create Worker Service**:
   - Name: `createlen-worker`
   - Runtime: Node
   - Build Command: `npm ci`
   - Start Command: `npm run worker`
   - Branch: `copilot/add-openai-scaffold`

3. **Add Environment Variables** to both services (see list above)

### 5. Verify Deployment

1. Check web service health: `https://your-app.onrender.com/health`
2. Test sync generation:
   ```bash
   curl -X POST https://your-app.onrender.com/generate \
     -H "Content-Type: application/json" \
     -d '{
       "token": "your-secret-token",
       "brief": "Услуги по регистрации ООО",
       "sessionId": "test-1"
     }'
   ```

3. Test async generation:
   ```bash
   curl -X POST https://your-app.onrender.com/generate \
     -H "Content-Type: application/json" \
     -d '{
       "token": "your-secret-token",
       "brief": "Услуги по регистрации ООО",
       "sessionId": "test-2",
       "async": true
     }'
   ```

4. Check session status:
   ```bash
   curl https://your-app.onrender.com/api/session/test-2?token=your-secret-token
   ```

## Migration Strategy

The app will automatically run migrations on startup via `initMigrations()` in `server/db.js`.

For manual migration control:
```bash
# Connect to database
psql "$DATABASE_URL"

# Run migration
\i scripts/migrate.sql
```

## Monitoring

1. **Render Dashboard**: View logs, metrics, and health status
2. **BullMQ Dashboard**: TODO - Add Bull Board for queue monitoring
3. **Database**: Use Supabase dashboard for query insights
4. **Logs**: Check Render logs for errors and warnings

## Troubleshooting

### Worker not processing jobs
- Check REDIS_URL is correct
- Verify worker is running in Render dashboard
- Check worker logs for connection errors

### Database connection failed
- Verify DATABASE_URL is correct
- Check if migration was applied
- Test connection with `psql`

### S3 upload failed
- Verify S3 credentials and bucket name
- Check IAM permissions
- Ensure bucket region matches S3_REGION

### Health check failing
- Verify `/health` endpoint returns 200
- Check if server is binding to correct port (use `process.env.PORT`)

## Cost Optimization

- **Render**: Use Starter plan ($7/month per service)
- **Supabase**: Free tier includes 500MB database
- **Upstash**: Free tier includes 10,000 commands/day
- **S3**: Pay only for storage and requests (very cheap for low volume)

**Estimated monthly cost**: ~$15-20 for low to medium traffic

## Next Steps

- [ ] Add Bull Board for queue monitoring
- [ ] Set up error alerting (Sentry, etc.)
- [ ] Add request logging and analytics
- [ ] Implement rate limiting
- [ ] Add automatic session cleanup (retention policy)
- [ ] Set up staging environment
