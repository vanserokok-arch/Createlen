# Deploying Createlen to Render

This guide provides step-by-step instructions for deploying the Createlen autonomous landing generator to Render with all required infrastructure components.

## Prerequisites

Before deploying to Render, you need to set up the following external services:

### 1. AWS S3 (for storing generated landing files)

1. Log in to [AWS Console](https://console.aws.amazon.com/)
2. Navigate to S3 and create a new bucket:
   - Bucket name: e.g., `createlen-landings-prod`
   - Region: Select your preferred region (e.g., `us-east-1`)
   - Disable "Block all public access" if you want direct public access, or keep enabled and use presigned URLs
3. Create an IAM user for Render:
   - Go to IAM → Users → Add User
   - User name: `createlen-render`
   - Access type: Programmatic access
   - Attach policy: `AmazonS3FullAccess` or create a custom policy with permissions:
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
           "Resource": "arn:aws:s3:::createlen-landings-prod/*"
         }
       ]
     }
     ```
4. Save the Access Key ID and Secret Access Key

### 2. Supabase PostgreSQL (for session storage)

1. Sign up at [Supabase](https://supabase.com/)
2. Create a new project:
   - Project name: `createlen-prod`
   - Database password: Generate a strong password
   - Region: Select closest to your Render region
3. Wait for project to be provisioned (2-3 minutes)
4. Get the connection string:
   - Go to Project Settings → Database
   - Copy the "Connection string" under "Connection pooling"
   - Format: `postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`
5. Save the connection string

### 3. Upstash Redis (for job queue)

1. Sign up at [Upstash](https://upstash.com/)
2. Create a new Redis database:
   - Name: `createlen-queue-prod`
   - Type: Regional
   - Region: Select closest to your Render region
   - TLS: Enabled (recommended)
3. Get the connection details:
   - Go to your database details page
   - Copy the "Redis URL" from the connection section
   - Format: `rediss://default:[password]@[region]-[id].upstash.io:6379`
4. Save the Redis URL

## Deployment Steps

### Step 1: Prepare Your Repository

1. Ensure your code is pushed to GitHub on the `copilot/add-openai-scaffold` branch
2. Verify all files are committed:
   ```bash
   git status
   git push origin copilot/add-openai-scaffold
   ```

### Step 2: Create Render Services

#### Option A: Using render.yaml (Recommended)

1. Log in to [Render](https://render.com/)
2. Click "New" → "Blueprint"
3. Connect your GitHub repository
4. Select the repository: `vanserokok-arch/Createlen`
5. Select branch: `copilot/add-openai-scaffold`
6. Render will detect the `render.yaml` file and create both services

#### Option B: Manual Service Creation

**Web Service:**
1. Click "New" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - Name: `createlen-web`
   - Branch: `copilot/add-openai-scaffold`
   - Build Command: `npm ci`
   - Start Command: `npm start`
   - Health Check Path: `/health`

**Worker Service:**
1. Click "New" → "Background Worker"
2. Connect your GitHub repository
3. Configure:
   - Name: `createlen-worker`
   - Branch: `copilot/add-openai-scaffold`
   - Build Command: `npm ci`
   - Start Command: `npm run worker`

### Step 3: Configure Environment Variables

For **both** services (Web and Worker), add the following environment variables in the Render Dashboard:

#### OpenAI Configuration
- `OPENAI_API_KEY`: Your OpenAI API key from [platform.openai.com](https://platform.openai.com/api-keys)
- `OPENAI_MODEL`: `gpt-4o-mini` (or your preferred model)

#### Authentication
- `ALLOWED_TOKEN`: Generate a secure random token (use: `openssl rand -hex 32`)

#### AWS S3 Configuration
- `S3_BUCKET`: Your S3 bucket name (e.g., `createlen-landings-prod`)
- `S3_ACCESS_KEY_ID`: AWS IAM Access Key ID from Step 1
- `S3_SECRET_ACCESS_KEY`: AWS IAM Secret Access Key from Step 1
- `S3_REGION`: Your S3 bucket region (e.g., `us-east-1`)

#### Database Configuration (Supabase)
- `DATABASE_URL`: Your Supabase connection string from Step 2

#### Redis Configuration (Upstash)
- `REDIS_URL`: Your Upstash Redis URL from Step 3

#### Additional Configuration
- `NODE_ENV`: `production`
- `API_URL`: Your Render web service URL (e.g., `https://createlen-web.onrender.com`) - set this for the worker only
- `WORKER_CONCURRENCY`: `2` (adjust based on your worker plan) - worker only

**Important:** For the worker service, set the `API_URL` to the URL of your web service so the worker can call the generation endpoint.

### Step 4: Deploy Services

1. Render will automatically start building and deploying your services
2. Monitor the build logs for any errors
3. Wait for both services to show "Live" status

### Step 5: Run Database Migrations

After the web service is deployed, run the database migrations:

#### Option A: Using Render Shell
1. Go to your web service in Render Dashboard
2. Click "Shell" in the top navigation
3. Run the migration command:
   ```bash
   npm run migrate
   ```

#### Option B: Using One-Off Job
1. In the Render Dashboard, go to your web service
2. Click "Manual Deploy" → "Run Command"
3. Enter: `npm run migrate`
4. Click "Run"

### Step 6: Verify Deployment

1. Check the health endpoint:
   ```bash
   curl https://createlen-web.onrender.com/health
   ```
   
   Expected response:
   ```json
   {
     "status": "ok",
     "timestamp": "2024-01-15T12:00:00.000Z",
     "uptime": 123.45,
     "checks": {
       "database": "ok",
       "redis": "ok",
       "s3": "ok"
     }
   }
   ```

2. Test the synchronous generation endpoint:
   ```bash
   curl -X POST https://createlen-web.onrender.com/generate \
     -H "Content-Type: application/json" \
     -d '{
       "brief": "Юридические услуги для бизнеса",
       "page_type": "invest",
       "token": "YOUR_ALLOWED_TOKEN"
     }'
   ```

3. Check worker logs in Render Dashboard to ensure it's running

## Environment Variables Reference

Complete list of required environment variables:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NODE_ENV` | Yes | Node environment | `production` |
| `OPENAI_API_KEY` | Yes | OpenAI API key | `sk-...` |
| `OPENAI_MODEL` | No | OpenAI model to use | `gpt-4o-mini` |
| `ALLOWED_TOKEN` | Yes | API authentication token | `abc123...` |
| `S3_BUCKET` | Yes | AWS S3 bucket name | `createlen-landings-prod` |
| `S3_ACCESS_KEY_ID` | Yes | AWS IAM access key | `AKIAIOSFODNN7EXAMPLE` |
| `S3_SECRET_ACCESS_KEY` | Yes | AWS IAM secret key | `wJalrXUtnFEMI/K7MDENG/...` |
| `S3_REGION` | Yes | AWS S3 region | `us-east-1` |
| `DATABASE_URL` | Yes | PostgreSQL connection URL | `postgresql://postgres...` |
| `REDIS_URL` | Yes | Redis connection URL | `rediss://default:...` |
| `API_URL` | Worker only | Web service URL | `https://createlen-web.onrender.com` |
| `WORKER_CONCURRENCY` | Worker only | Number of concurrent jobs | `2` |

## Troubleshooting

### Health check fails
- Check that all environment variables are set correctly
- Verify database connection: Check DATABASE_URL format and credentials
- Verify Redis connection: Check REDIS_URL format and credentials
- Check logs in Render Dashboard for specific error messages

### Worker not processing jobs
- Verify REDIS_URL is identical in both web and worker services
- Check worker logs for connection errors
- Verify API_URL is set correctly to point to the web service
- Test Redis connectivity from worker shell: `redis-cli ping` (if available)

### S3 upload fails
- Verify S3 credentials (S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY)
- Check IAM permissions for the user
- Verify bucket name and region are correct
- Check bucket CORS settings if needed

### Database migration fails
- Check DATABASE_URL format
- Verify Supabase project is active
- Check database logs in Supabase Dashboard
- Ensure migrations haven't already been run

### OpenAI API errors
- Verify OPENAI_API_KEY is valid and has credits
- Check OpenAI service status: [status.openai.com](https://status.openai.com/)
- Verify model name is correct (e.g., `gpt-4o-mini`)

## Build Commands

- **Build**: `npm ci`
- **Start Web**: `npm start`
- **Start Worker**: `npm run worker`
- **Run Migrations**: `npm run migrate`
- **Run Tests**: `npm test`
- **Lint**: `npm run lint`

## Health Check

The web service exposes a `/health` endpoint that checks:
- Database connectivity
- Redis connectivity
- S3 configuration
- Application uptime

Configure Render health check:
- Path: `/health`
- Expected status: `200`
- Timeout: 30 seconds

## Scaling

### Web Service Scaling
- Horizontal: Increase instance count in Render Dashboard
- Vertical: Upgrade to a higher tier plan

### Worker Service Scaling
- Adjust `WORKER_CONCURRENCY` environment variable (default: 2)
- Recommended values:
  - Starter plan: 1-2
  - Standard plan: 2-5
  - Pro plan: 5-10
- Add more worker instances for higher throughput

## Monitoring

1. **Render Dashboard**:
   - Check service status
   - View logs
   - Monitor resource usage

2. **Database Monitoring**:
   - Supabase Dashboard → Database → Logs
   - Check connection count and query performance

3. **Redis Monitoring**:
   - Upstash Console → Database Details
   - Monitor memory usage and connection count

4. **S3 Monitoring**:
   - AWS CloudWatch → S3 Metrics
   - Track bucket size and request count

## Cost Estimates

Approximate monthly costs:

- **Render Web Service**: $7/month (Starter plan)
- **Render Worker Service**: $7/month (Starter plan)
- **Supabase**: Free tier (up to 500MB database)
- **Upstash Redis**: Free tier (10,000 commands/day)
- **AWS S3**: ~$0.023/GB storage + $0.09/GB transfer

**Total**: ~$14-20/month (depending on usage)

## Support

For issues specific to:
- Render: [Render Support](https://render.com/docs)
- Supabase: [Supabase Docs](https://supabase.com/docs)
- Upstash: [Upstash Docs](https://docs.upstash.com/)
- AWS S3: [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
