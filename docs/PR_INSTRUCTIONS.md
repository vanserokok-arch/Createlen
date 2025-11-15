# Pull Request Instructions for Repository Owner

This PR adds a complete autonomous landing page generation system with OpenAI integration, background job processing, and cloud storage.

## What Was Added

### Core System Components
1. **render.yaml** - Render.com deployment configuration
2. **worker/worker.js** - Background job processor (BullMQ)
3. **server/db.js** - PostgreSQL database wrapper
4. **server/queue.js** - Redis queue management
5. **server/s3.js** - S3 storage helper
6. **server/health.js** - Health check endpoint
7. **scripts/migrate.sql** - Database schema migration

### CI/CD & Documentation
8. **.github/workflows/ci.yml** - Updated CI pipeline
9. **docs/DEPLOY_RENDER.md** - Comprehensive deployment guide
10. **docs/EXAMPLES.md** - API usage examples
11. **README.md** - Updated with autonomous mode documentation
12. **.env.example** - Environment variables template

### Updated Files
- **server.js** - Added health check endpoint integration
- **package.json** - Added dependencies: bullmq, pg, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner
- **.gitignore** - Updated to exclude build artifacts

## How to Deploy on Render.com

### Step 1: Prepare External Services

#### A. Create AWS S3 Bucket
1. Go to AWS Console → S3
2. Create a new bucket (e.g., `createlen-artifacts`)
3. Note: Bucket name, Region
4. Create IAM user with permissions:
   - `s3:PutObject`
   - `s3:GetObject`
5. Generate access key ID and secret access key

#### B. Get OpenAI API Key
1. Go to https://platform.openai.com
2. Create API key
3. Save it securely

### Step 2: Deploy to Render Using Blueprint

#### Option A: Automatic Deployment (Recommended)

1. **Push this branch to GitHub**
   ```bash
   git push origin copilot/add-openai-scaffold
   ```

2. **Go to Render Dashboard**
   - Visit https://dashboard.render.com
   - Click **New** → **Blueprint**
   - Connect your GitHub repository
   - Select branch: `copilot/add-openai-scaffold`
   - Render will automatically create:
     - Web Service (createlen-web)
     - Worker Service (createlen-worker)
     - PostgreSQL Database (createlen-db)
     - Redis Instance (createlen-redis)

3. **Configure Environment Variables**
   
   For **createlen-web** service:
   - `OPENAI_KEY` = `sk-...` (your OpenAI API key)
   - `ALLOWED_TOKEN` = `<generate-strong-random-token>`
   - `S3_BUCKET` = `createlen-artifacts` (your bucket name)
   - `S3_ACCESS_KEY_ID` = `AKIA...` (your AWS access key)
   - `S3_SECRET_ACCESS_KEY` = `<your-aws-secret-key>`
   - `S3_REGION` = `us-east-1` (your bucket region)
   
   Note: `DATABASE_URL` and `REDIS_URL` are auto-populated from linked services

   For **createlen-worker** service:
   - Same variables as web service

4. **Generate Strong Random Token**
   ```bash
   # Generate a secure random token
   openssl rand -hex 32
   # or
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

### Step 3: Run Database Migration

After PostgreSQL database is deployed:

1. **Get Database Connection String**
   - Go to createlen-db dashboard in Render
   - Copy "External Database URL"

2. **Run Migration**
   ```bash
   psql "postgresql://USER:PASSWORD@HOST/DATABASE" < scripts/migrate.sql
   ```

3. **Verify Migration**
   ```bash
   psql "postgresql://USER:PASSWORD@HOST/DATABASE" -c "\d sessions"
   ```
   
   You should see the sessions table with columns: id, session_id, status, brief, etc.

### Step 4: Verify Deployment

1. **Check Health Endpoint**
   ```bash
   curl https://createlen-web.onrender.com/health
   ```
   
   Expected response:
   ```json
   {
     "status": "healthy",
     "dependencies": {
       "database": {"status": "healthy"},
       "queue": {"status": "healthy"},
       "s3": {"status": "configured"},
       "openai": {"status": "configured"}
     }
   }
   ```

2. **Test Landing Page Generation**
   ```bash
   curl -X POST https://createlen-web.onrender.com/generate \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_ALLOWED_TOKEN" \
     -d '{
       "brief": "Юридическая помощь по инвестиционным спорам в России",
       "page_type": "invest",
       "sessionId": "test-session-1",
       "token": "YOUR_ALLOWED_TOKEN"
     }'
   ```

3. **Check Worker Logs**
   - Go to createlen-worker dashboard in Render
   - View logs
   - You should see: "Worker started. Listening for jobs on queue: landing-generation"

4. **Verify Database**
   ```bash
   psql "postgresql://USER:PASSWORD@HOST/DATABASE" \
     -c "SELECT session_id, status FROM sessions ORDER BY created_at DESC LIMIT 5;"
   ```

## Environment Variables Summary

### Required Environment Variables

| Variable | Where to Get | Example | Notes |
|----------|-------------|---------|-------|
| `OPENAI_KEY` | https://platform.openai.com | `sk-proj-...` | Your OpenAI API key |
| `ALLOWED_TOKEN` | Generate random | `a1b2c3d4...` | Use `openssl rand -hex 32` |
| `S3_BUCKET` | AWS S3 Console | `createlen-artifacts` | Bucket name |
| `S3_ACCESS_KEY_ID` | AWS IAM | `AKIA...` | IAM user access key |
| `S3_SECRET_ACCESS_KEY` | AWS IAM | `wJalrXUtn...` | IAM user secret key |
| `S3_REGION` | AWS S3 Console | `us-east-1` | Bucket region |
| `DATABASE_URL` | Auto (Render) | `postgresql://...` | Auto-populated |
| `REDIS_URL` | Auto (Render) | `redis://...` | Auto-populated |

### Optional Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | 3000 | Server port (auto-set by Render) |
| `NODE_ENV` | production | Environment mode |

## Cost Estimation

### Render Free Tier (Good for Testing)
- Web Service: 750 hours/month free
- Worker Service: 750 hours/month free  
- PostgreSQL Starter: Free
- Redis Starter: Free
- **Total Render Cost**: $0/month

### AWS Costs
- S3 Storage: ~$0.023/GB/month
- S3 PUT Requests: $0.005 per 1,000 requests
- S3 GET Requests: $0.0004 per 1,000 requests
- **Estimated S3 Cost**: ~$1-5/month for typical usage

### OpenAI Costs (Variable)
- GPT-4 Mini (gpt-4o-mini): ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- Average generation: ~400 tokens = ~$0.0004 per landing page
- **Estimated OpenAI Cost**: Depends on usage (e.g., 1000 generations/month = ~$0.40)

### Total Estimated Monthly Cost
- **Free Tier**: ~$1-5/month (S3 + OpenAI usage)
- **Production**: ~$35-150/month (paid Render plans + S3 + OpenAI)

## Monitoring and Maintenance

### Daily Checks
1. Monitor worker logs for errors
2. Check health endpoint status
3. Review OpenAI API usage

### Weekly Tasks
1. Review failed sessions in database
2. Clean up old completed sessions (>30 days)
3. Check S3 storage growth
4. Monitor costs (AWS, OpenAI, Render)

### Database Cleanup Script
```sql
-- Run weekly to clean up old sessions
DELETE FROM sessions
WHERE status = 'completed'
  AND created_at < NOW() - INTERVAL '30 days';
```

## Troubleshooting

### Worker Not Processing Jobs
1. Check worker is running: Render dashboard → createlen-worker → Status
2. View worker logs for errors
3. Verify `REDIS_URL` is set correctly
4. Verify `OPENAI_KEY` is valid

### S3 Upload Failures
1. Verify S3 credentials are correct
2. Check IAM permissions (PutObject, GetObject)
3. Verify bucket exists and region matches
4. Check Render logs for detailed error messages

### Database Connection Issues
1. Verify database is running
2. Check `DATABASE_URL` format
3. Ensure migration was run successfully
4. Check database logs in Render

### OpenAI API Errors
1. Verify API key is active
2. Check OpenAI account has sufficient credits
3. Monitor rate limits (tier-based)
4. Check OpenAI status page: https://status.openai.com

## Security Recommendations

1. **Rotate Secrets Regularly**
   - Update `ALLOWED_TOKEN` every 90 days
   - Rotate AWS credentials every 6 months
   - Monitor for compromised keys

2. **Enable MFA**
   - Enable MFA on AWS account
   - Enable MFA on Render account
   - Enable MFA on OpenAI account

3. **Monitor Access Logs**
   - Review Render access logs monthly
   - Monitor S3 access logs
   - Check for unusual API usage patterns

4. **Set Up Alerts**
   - AWS billing alerts
   - OpenAI usage alerts
   - Render health check alerts

## Next Steps After Deployment

1. **Test the System**
   - Generate a few test landing pages
   - Verify S3 uploads work
   - Check database records are created

2. **Set Up Monitoring**
   - Configure Render health check alerts
   - Set up AWS billing alerts
   - Monitor OpenAI usage dashboard

3. **Optional Enhancements**
   - Add rate limiting to API endpoints
   - Create admin dashboard for job monitoring
   - Implement webhook notifications
   - Add job status API endpoint
   - Set up automated database backups

4. **Documentation**
   - Share API endpoint URL with team
   - Provide authentication token to authorized users
   - Document any custom configurations

## Support and Resources

- **Deployment Guide**: See `docs/DEPLOY_RENDER.md`
- **API Examples**: See `docs/EXAMPLES.md`
- **Render Documentation**: https://render.com/docs
- **OpenAI Documentation**: https://platform.openai.com/docs
- **AWS S3 Documentation**: https://docs.aws.amazon.com/s3/

## Example: Complete Setup Command Sequence

```bash
# 1. Generate authentication token
export ALLOWED_TOKEN=$(openssl rand -hex 32)
echo "Save this token: $ALLOWED_TOKEN"

# 2. After Render deployment, get database URL from Render dashboard
export DATABASE_URL="postgresql://user:pass@host/db"

# 3. Run migration
psql "$DATABASE_URL" < scripts/migrate.sql

# 4. Verify migration
psql "$DATABASE_URL" -c "\d sessions"

# 5. Test health endpoint
curl https://your-web-service.onrender.com/health

# 6. Test generation (replace YOUR_ALLOWED_TOKEN with token from step 1)
curl -X POST https://your-web-service.onrender.com/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ALLOWED_TOKEN" \
  -d '{
    "brief": "Тестовый brief для юридических услуг",
    "page_type": "invest",
    "sessionId": "test-'$(date +%s)'",
    "token": "YOUR_ALLOWED_TOKEN"
  }' | jq .

# 7. Check database for generated session
psql "$DATABASE_URL" -c "SELECT * FROM sessions ORDER BY created_at DESC LIMIT 1;"
```

---

## PR Merge Checklist

Before merging this PR:

- [ ] Review all new files and changes
- [ ] Verify no secrets are committed to repository
- [ ] Ensure `.gitignore` is updated
- [ ] Confirm documentation is complete
- [ ] Test deployment on Render.com
- [ ] Run database migration successfully
- [ ] Verify health endpoint returns "healthy"
- [ ] Test landing page generation
- [ ] Verify worker processes jobs
- [ ] Check S3 uploads work correctly
- [ ] Monitor costs for first week

---

**Ready to deploy!** Follow the steps above to set up the autonomous landing page generation system on Render.com.
