# Example Usage: Autonomous Landing Page Generation

This document provides examples of using the autonomous generation feature.

## Prerequisites

Ensure the following environment variables are set:
- `OPENAI_KEY` or `OPENAI_API_KEY`
- `DATABASE_URL` (Supabase PostgreSQL)
- `REDIS_URL` (Upstash Redis)
- `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`
- `ALLOWED_TOKEN` (for API authentication)

## Synchronous Generation (Existing Behavior)

```bash
curl -X POST http://localhost:3000/generate \
  -H "Content-Type: application/json" \
  -d '{
    "token": "your-secret-token",
    "brief": "Юридические услуги для стартапов: регистрация компаний, договоры, IP защита",
    "page_type": "invest"
  }'
```

**Response (immediate):**
```json
{
  "hero": {
    "title": "Юридические услуги для стартапов",
    "subtitle": "Регистрация, договоры, защита IP",
    "cta": "Получить консультацию"
  },
  "benefits": [...],
  "process": [...],
  "faq": [...],
  "seo": {...}
}
```

## Asynchronous Generation (New Feature)

### Step 1: Submit Generation Task

```bash
curl -X POST http://localhost:3000/generate \
  -H "Content-Type: application/json" \
  -d '{
    "token": "your-secret-token",
    "brief": "Юридические услуги для стартапов: регистрация компаний, договоры, IP защита",
    "page_type": "invest",
    "async": true
  }'
```

**Response (immediate):**
```json
{
  "sessionId": "session-1700000000000",
  "status": "queued",
  "message": "Generation task enqueued. Use GET /session/:sessionId to check status."
}
```

### Step 2: Poll for Status

```bash
# Check status immediately
curl http://localhost:3000/session/session-1700000000000
```

**Response (while processing):**
```json
{
  "sessionId": "session-1700000000000",
  "status": "processing",
  "payload": null,
  "artifact_url": null,
  "created_at": "2024-01-01T10:00:00.000Z",
  "updated_at": "2024-01-01T10:00:05.000Z"
}
```

### Step 3: Get Completed Results

```bash
# Poll again after some time (typically 5-30 seconds)
curl http://localhost:3000/session/session-1700000000000
```

**Response (when completed):**
```json
{
  "sessionId": "session-1700000000000",
  "status": "completed",
  "artifact_url": "https://your-bucket.s3.us-east-1.amazonaws.com/sessions/session-1700000000000/landing-1700000030000.html",
  "payload": {
    "brief": "Юридические услуги для стартапов...",
    "page_type": "invest",
    "htmlUrl": "https://your-bucket.s3.us-east-1.amazonaws.com/sessions/session-1700000000000/landing-1700000030000.html",
    "jsonUrl": "https://your-bucket.s3.us-east-1.amazonaws.com/sessions/session-1700000000000/landing-1700000030000.json",
    "data": {
      "hero": {...},
      "benefits": [...],
      "process": [...],
      "faq": [...],
      "seo": {...}
    }
  },
  "created_at": "2024-01-01T10:00:00.000Z",
  "updated_at": "2024-01-01T10:00:30.000Z"
}
```

## Health Check

```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T10:00:00.000Z",
  "uptime": 3600.5,
  "services": {
    "database": true,
    "redis": true,
    "openai": true,
    "s3": true
  }
}
```

**Response (degraded - some services unavailable):**
```json
{
  "status": "degraded",
  "timestamp": "2024-01-01T10:00:00.000Z",
  "uptime": 3600.5,
  "services": {
    "database": false,
    "redis": false,
    "openai": true,
    "s3": true
  }
}
```

## Error Handling

### Invalid Token
```bash
curl -X POST http://localhost:3000/generate \
  -H "Content-Type: application/json" \
  -d '{
    "token": "wrong-token",
    "brief": "Test",
    "async": true
  }'
```

**Response:**
```json
{
  "error": "Unauthorized: invalid token"
}
```

### Session Not Found
```bash
curl http://localhost:3000/session/non-existent-session
```

**Response:**
```json
{
  "error": "Session not found"
}
```

### Failed Generation
```bash
curl http://localhost:3000/session/failed-session-id
```

**Response:**
```json
{
  "sessionId": "failed-session-id",
  "status": "failed",
  "payload": {
    "brief": "...",
    "page_type": "invest",
    "error": "OpenAI API error: Rate limit exceeded"
  },
  "artifact_url": null,
  "created_at": "2024-01-01T10:00:00.000Z",
  "updated_at": "2024-01-01T10:00:15.000Z"
}
```

## JavaScript Client Example

```javascript
// Submit async generation
async function generateLanding(brief, pageType = 'invest') {
  const response = await fetch('http://localhost:3000/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: 'your-secret-token',
      brief,
      page_type: pageType,
      async: true
    })
  });
  
  const data = await response.json();
  return data.sessionId;
}

// Poll for status
async function pollSession(sessionId, maxAttempts = 30, interval = 2000) {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`http://localhost:3000/session/${sessionId}`);
    const session = await response.json();
    
    if (session.status === 'completed') {
      return session;
    } else if (session.status === 'failed') {
      throw new Error(`Generation failed: ${session.payload?.error}`);
    }
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error('Generation timeout');
}

// Usage
(async () => {
  try {
    const sessionId = await generateLanding(
      'Юридические услуги для стартапов: регистрация, договоры, IP'
    );
    console.log('Generation started:', sessionId);
    
    const result = await pollSession(sessionId);
    console.log('Generation completed!');
    console.log('HTML:', result.artifact_url);
    console.log('JSON:', result.payload.jsonUrl);
    console.log('Data:', result.payload.data);
  } catch (error) {
    console.error('Error:', error.message);
  }
})();
```

## Worker Service

The worker runs separately and processes jobs from the queue:

```bash
# Start worker
node worker/worker.js

# Worker output:
# Worker started and waiting for jobs...
# Processing job session-1700000000000 for session session-1700000000000
# Job session-1700000000000 completed successfully
# Job session-1700000000000 has completed
```

## Monitoring

### Queue Status (via Redis CLI)
```bash
redis-cli -u $REDIS_URL
> LLEN bull:landing-generation:wait
> LLEN bull:landing-generation:active
> LLEN bull:landing-generation:completed
> LLEN bull:landing-generation:failed
```

### Database Sessions
```sql
-- Check recent sessions
SELECT session_id, status, created_at, updated_at 
FROM sessions 
ORDER BY created_at DESC 
LIMIT 10;

-- Check session counts by status
SELECT status, COUNT(*) 
FROM sessions 
GROUP BY status;
```

### S3 Artifacts
```bash
# List artifacts for a session
aws s3 ls s3://your-bucket/sessions/session-1700000000000/
```

## Notes

- The worker processes jobs with concurrency of 2
- Jobs are retried up to 3 times on failure with exponential backoff
- Completed jobs are kept for 24 hours
- Failed jobs are kept for 7 days
- Session IDs are auto-generated using timestamp: `session-{timestamp}`
