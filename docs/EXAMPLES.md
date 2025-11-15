# Example Usage for Autonomous Landing Page Generation

This document provides examples of how to use the Createlen autonomous landing page generation system.

## Prerequisites

All environment variables must be configured in Render dashboard (see DEPLOY_RENDER.md):

- `OPENAI_KEY` - Your OpenAI API key
- `ALLOWED_TOKEN` - Authentication token for API access
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION` - S3 credentials

## API Endpoints

### 1. Health Check

Check if all services are running correctly:

```bash
curl https://your-service.onrender.com/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T12:00:00.000Z",
  "uptime": 123.45,
  "responseTime": 45,
  "dependencies": {
    "database": {"status": "healthy"},
    "queue": {"status": "healthy"},
    "s3": {"status": "configured"},
    "openai": {"status": "configured"}
  }
}
```

### 2. Generate Landing Page (Synchronous)

The original endpoint that returns results immediately:

```bash
curl -X POST https://your-service.onrender.com/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ALLOWED_TOKEN" \
  -d '{
    "brief": "Юридическая помощь по инвестиционным спорам в России. Защита прав инвесторов, взыскание убытков, арбитраж.",
    "page_type": "invest",
    "sessionId": "invest-2024-01-15",
    "token": "YOUR_ALLOWED_TOKEN"
  }'
```

Response (immediate):
```json
{
  "hero": {
    "title": "Защита инвестиционных интересов в России",
    "subtitle": "Профессиональная юридическая помощь по инвестиционным спорам",
    "cta": "Получить консультацию"
  },
  "benefits": [
    {
      "title": "Опытные специалисты",
      "text": "Наши юристы специализируются на инвестиционных спорах более 10 лет"
    }
  ],
  "process": [
    {
      "step_title": "Консультация",
      "step_text": "Бесплатная первичная консультация по вашему делу"
    }
  ],
  "faq": [
    {
      "q": "Сколько стоят услуги?",
      "a": "Стоимость зависит от сложности дела. Консультация бесплатна."
    }
  ],
  "seo": {
    "title": "Юридическая помощь по инвестиционным спорам | Юридическая фирма",
    "description": "Защита прав инвесторов, взыскание убытков, арбитраж в России"
  }
}
```

### 3. Export Landing Page as ZIP

Download the generated landing page as a ZIP file:

```bash
curl -X GET "https://your-service.onrender.com/export?sessionId=invest-2024-01-15&token=YOUR_ALLOWED_TOKEN" \
  -o landing.zip
```

The ZIP contains:
- `landing.html` - Ready-to-use HTML file
- `landing.json` - Structured JSON data

### 4. Autonomous Mode (via Database)

For autonomous processing, the system automatically:

1. **Creates a database session** when you call `/generate`
2. **Queues a job** in Redis for background processing
3. **Worker processes the job** asynchronously
4. **Saves artifacts to S3** when complete
5. **Updates database** with status and URLs

#### Query Session Status

Connect to your PostgreSQL database and check session status:

```sql
-- List recent sessions
SELECT 
    session_id, 
    status, 
    created_at, 
    updated_at 
FROM sessions 
ORDER BY created_at DESC 
LIMIT 10;

-- Get specific session details
SELECT * FROM sessions WHERE session_id = 'invest-2024-01-15';

-- Count sessions by status
SELECT status, COUNT(*) as count 
FROM sessions 
GROUP BY status;
```

Status values:
- `pending` - Job queued, waiting for worker
- `processing` - Worker is currently processing
- `completed` - Job completed successfully (check `s3_json_url` and `s3_html_url`)
- `failed` - Job failed (check `error_message`)

#### Retrieve Generated Artifacts from S3

After a job completes, artifacts are available in S3:

```bash
# JSON artifact
curl -o landing.json "https://your-bucket.s3.amazonaws.com/sessions/invest-2024-01-15/landing.json"

# HTML artifact
curl -o landing.html "https://your-bucket.s3.amazonaws.com/sessions/invest-2024-01-15/landing.html"
```

Or query from database to get URLs:

```sql
SELECT s3_json_url, s3_html_url 
FROM sessions 
WHERE session_id = 'invest-2024-01-15' 
  AND status = 'completed';
```

## Integration Examples

### Node.js Integration

```javascript
import fetch from 'node-fetch';

const RENDER_URL = 'https://your-service.onrender.com';
const AUTH_TOKEN = process.env.ALLOWED_TOKEN;

async function generateLanding(brief, pageType = 'invest') {
  const sessionId = `landing-${Date.now()}`;
  
  const response = await fetch(`${RENDER_URL}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_TOKEN}`
    },
    body: JSON.stringify({
      brief,
      page_type: pageType,
      sessionId,
      token: AUTH_TOKEN
    })
  });

  if (!response.ok) {
    throw new Error(`Generation failed: ${response.statusText}`);
  }

  return await response.json();
}

// Usage
const result = await generateLanding(
  'Юридическая помощь по корпоративным спорам'
);
console.log('Generated landing:', result);
```

### Python Integration

```python
import requests
import os

RENDER_URL = 'https://your-service.onrender.com'
AUTH_TOKEN = os.environ['ALLOWED_TOKEN']

def generate_landing(brief, page_type='invest'):
    session_id = f'landing-{int(time.time())}'
    
    response = requests.post(
        f'{RENDER_URL}/generate',
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {AUTH_TOKEN}'
        },
        json={
            'brief': brief,
            'page_type': page_type,
            'sessionId': session_id,
            'token': AUTH_TOKEN
        }
    )
    
    response.raise_for_status()
    return response.json()

# Usage
result = generate_landing('Юридическая помощь по семейным делам')
print(f'Generated landing: {result}')
```

### Database Query Examples

#### Get All Failed Sessions

```sql
SELECT 
    session_id,
    brief,
    error_message,
    created_at
FROM sessions
WHERE status = 'failed'
ORDER BY created_at DESC;
```

#### Clean Up Old Completed Sessions

```sql
-- Delete sessions older than 30 days
DELETE FROM sessions
WHERE status = 'completed'
  AND created_at < NOW() - INTERVAL '30 days';
```

#### Get Session Statistics

```sql
SELECT 
    DATE(created_at) as date,
    status,
    COUNT(*) as count,
    AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_duration_seconds
FROM sessions
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at), status
ORDER BY date DESC, status;
```

## Worker Monitoring

Monitor worker logs in Render dashboard to see:

```
Worker started. Listening for jobs on queue: landing-generation
Processing job test-session-1: test-session-1
Calling OpenAI for session test-session-1
Uploading artifacts to S3 for session test-session-1
Job completed successfully: test-session-1
✓ Job test-session-1 completed: { sessionId: 'test-session-1', status: 'completed', ... }
```

## Troubleshooting

### Session Stuck in "pending" Status

1. Check if worker is running: Monitor worker logs in Render
2. Check Redis connection: Verify `REDIS_URL` in worker environment
3. Check queue: Connect to Redis and inspect queue

```bash
redis-cli
> LLEN bull:landing-generation:wait
> LRANGE bull:landing-generation:wait 0 -1
```

### Session Failed

1. Check error message in database:
```sql
SELECT error_message FROM sessions WHERE session_id = 'your-session-id';
```

2. Common errors:
   - "OpenAI API error": Check API key and quota
   - "S3 upload error": Verify S3 credentials and bucket permissions
   - "LLM returned non-JSON": OpenAI response format issue (retry)

### S3 Access Denied

1. Verify IAM permissions for S3 user:
   - `s3:PutObject` - Required for uploads
   - `s3:GetObject` - Required for downloads

2. Check bucket policy allows access from your IP/service

## Rate Limiting Recommendations

To prevent abuse and control costs:

1. **API Rate Limiting**: Add rate limiting middleware (e.g., express-rate-limit)
2. **OpenAI Rate Limiting**: Worker is configured with limiter (max 10 jobs/minute)
3. **Database Cleanup**: Regularly delete old completed sessions
4. **Monitor Costs**: Set up billing alerts in AWS and OpenAI

## Next Steps

1. Implement job status API endpoint
2. Add webhook notifications for completed jobs
3. Create admin dashboard for monitoring
4. Add retry mechanism for failed jobs
5. Implement job priority queuing

---

For more information, see:
- [Deployment Guide](DEPLOY_RENDER.md)
- [Main README](../README.md)
