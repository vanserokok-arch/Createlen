# Deploying Createlen to Render.com

This guide walks you through deploying the Createlen landing page generator to Render.com.

## Prerequisites

1. **Render.com account** - Sign up at https://render.com
2. **PostgreSQL database** - Will be created in Render
3. **Redis instance** - Use Upstash Redis (free tier available at https://upstash.com)
4. **AWS S3 bucket** - For storing generated landing pages
5. **OpenAI API key** - From https://platform.openai.com

## Environment Variables

You'll need to configure the following environment variables in Render:

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `ALLOWED_TOKEN` | API authentication token | `your-secret-token-123` |
| `DATABASE_URL` | PostgreSQL connection string | Auto-set by Render |
| `REDIS_URL` | Redis connection string (Upstash) | `rediss://default:...@...upstash.io:6379` |
| `S3_BUCKET` | S3 bucket name | `createlen-artifacts` |
| `S3_ACCESS_KEY_ID` | AWS access key ID | `AKIA...` |
| `S3_SECRET_ACCESS_KEY` | AWS secret access key | `...` |
| `S3_REGION` | AWS region | `us-east-1` |

### CI/CD Variables (Optional)

| Variable | Description |
|----------|-------------|
| `RENDER_API_KEY` | Render API key for deployments |
| `RENDER_SERVICE_ID` | Render service ID |

## Deployment Steps

### 1. Create Services on Render

There are two ways to deploy: using the Blueprint (recommended) or manual setup.

#### Option A: Using render.yaml Blueprint (Recommended)

1. Fork or clone the repository to your GitHub account
2. Go to https://render.com/dashboard
3. Click "New +" → "Blueprint"
4. Connect your GitHub repository
5. Render will automatically read `render.yaml` and create:
   - Web service (`createlen-web`)
   - Worker service (`createlen-worker`)
   - PostgreSQL database (`createlen-db`)

6. Set environment variables in the Render dashboard for both services
7. Click "Apply" to deploy

#### Option B: Manual Setup

##### 1.1 Create PostgreSQL Database

1. Go to https://render.com/dashboard
2. Click "New +" → "PostgreSQL"
3. Configure:
   - Name: `createlen-db`
   - Database: `createlen`
   - User: `createlen_user`
   - Region: Choose closest to you
   - Plan: Starter (free tier available)
4. Click "Create Database"
5. Note the Internal Database URL for later

##### 1.2 Create Web Service

1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - Name: `createlen-web`
   - Region: Same as database
   - Branch: `main` or your branch
   - Runtime: Node
   - Build Command: `npm ci`
   - Start Command: `node server/index.js`
   - Plan: Starter
4. Add environment variables (see table above)
5. Click "Create Web Service"

##### 1.3 Create Worker Service

1. Click "New +" → "Background Worker"
2. Connect the same repository
3. Configure:
   - Name: `createlen-worker`
   - Region: Same as database
   - Branch: Same as web service
   - Runtime: Node
   - Build Command: `npm ci`
   - Start Command: `node server/worker-process.js`
   - Plan: Starter
4. Add the same environment variables
5. Click "Create Worker"

### 2. Set Up External Services

#### 2.1 Upstash Redis

1. Go to https://console.upstash.com
2. Create a new Redis database
3. Choose a region close to your Render services
4. Copy the Redis URL (starts with `rediss://`)
5. Add it as `REDIS_URL` in Render environment variables

#### 2.2 AWS S3

1. Create an S3 bucket in AWS console
2. Configure bucket policy for public read access (optional):
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
3. Create IAM user with S3 access
4. Generate access keys
5. Add credentials to Render environment variables

### 3. Run Database Migration

Once the database is created and services are deployed:

1. Go to Render dashboard → PostgreSQL database
2. Click "Connect" → "External Connection"
3. Copy the connection string
4. Run migration locally:
   ```bash
   psql "postgres://..." -f scripts/migrate.sql
   ```

Or use Render Shell:
1. Go to Web Service → Shell tab
2. Run:
   ```bash
   psql "$DATABASE_URL" -f scripts/migrate.sql
   ```

### 4. Verify Deployment

1. Open your web service URL (e.g., `https://createlen-web.onrender.com`)
2. Check health endpoint:
   ```bash
   curl https://createlen-web.onrender.com/health
   ```
3. Test sync generation:
   ```bash
   curl -X POST https://createlen-web.onrender.com/generate \
     -H "Content-Type: application/json" \
     -d '{
       "token": "your-token",
       "brief": "Юридические услуги для бизнеса",
       "page_type": "corporate"
     }'
   ```
4. Test async generation:
   ```bash
   curl -X POST https://createlen-web.onrender.com/generate \
     -H "Content-Type: application/json" \
     -d '{
       "token": "your-token",
       "brief": "Инвестиционная компания",
       "page_type": "invest",
       "async": true
     }'
   ```

## Monitoring

### Logs

- View logs in Render dashboard under each service
- Filter by severity: Error, Warning, Info

### Health Checks

- Render automatically monitors the `/health` endpoint
- Services will restart if health checks fail

### Metrics

- View CPU, Memory, and Request metrics in Render dashboard
- Set up alerts for high resource usage

## Scaling

### Vertical Scaling

Upgrade service plans in Render dashboard:
- Starter → Standard → Pro

### Horizontal Scaling

For the worker service:
1. Go to Worker settings
2. Increase instance count
3. Workers will share the job queue automatically

## Troubleshooting

### Database Connection Issues

```bash
# Test database connection
psql "$DATABASE_URL" -c "SELECT 1"
```

### Redis Connection Issues

```bash
# Install redis-cli
npm install -g redis-cli

# Test connection
redis-cli -u "$REDIS_URL" ping
```

### OpenAI API Issues

- Check API key is valid
- Verify billing is set up in OpenAI dashboard
- Monitor rate limits

### S3 Upload Issues

- Verify IAM permissions include `s3:PutObject`
- Check bucket exists in specified region
- Ensure CORS is configured if accessing from browser

## Cost Optimization

1. **Use Free Tiers**:
   - Render: 750 hours/month free
   - Upstash Redis: 10K requests/day free
   - PostgreSQL: Starter plan available

2. **Optimize OpenAI Usage**:
   - Use `gpt-4o-mini` for cost-effective generation
   - Implement caching for repeated requests
   - Set reasonable `max_tokens` limits

3. **S3 Optimization**:
   - Enable lifecycle policies to delete old artifacts
   - Use S3 Intelligent-Tiering for cost savings

## Security Best Practices

1. **Never commit secrets** to version control
2. **Rotate credentials** regularly
3. **Use environment variables** for all sensitive data
4. **Enable HTTPS** (automatic on Render)
5. **Implement rate limiting** (TODO in application)
6. **Monitor for suspicious activity**

## Support

- Render documentation: https://render.com/docs
- Upstash documentation: https://docs.upstash.com
- GitHub issues: https://github.com/vanserokok-arch/Createlen/issues
