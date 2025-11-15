// worker/worker.js — BullMQ worker for processing landing generation tasks
import 'dotenv/config';
import { Worker } from 'bullmq';
import fetch from 'node-fetch';
import { updateSession, getPool } from '../server/db.js';
import { uploadJSONToS3 } from '../server/s3.js';

const REDIS_URL = process.env.REDIS_URL;
const OPENAI_KEY = process.env.OPENAI_KEY || process.env.OPENAI_API_KEY;

if (!REDIS_URL) {
  console.error('REDIS_URL environment variable is not set');
  process.exit(1);
}

if (!OPENAI_KEY) {
  console.error('OPENAI_KEY or OPENAI_API_KEY environment variable is not set');
  process.exit(1);
}

// Parse Redis URL
const redisUrl = new URL(REDIS_URL);
const connection = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port) || 6379,
  password: redisUrl.password || undefined,
  tls: redisUrl.protocol === 'rediss:' ? {} : undefined,
};

/**
 * Call OpenAI API directly to generate landing page content
 * @param {object} payload - Generation parameters (brief, page_type)
 * @returns {Promise<object>} Generated content
 */
async function generateWithOpenAI(payload) {
  const { brief = '', page_type = 'invest' } = payload;
  
  const userPrompt = `
You are a JSON generator for a Russian law firm's landing page.
Input brief: ${brief}
page_type: ${page_type}
Output ONLY valid JSON with structure:
{
  "hero": {"title":"", "subtitle":"", "cta":""},
  "benefits": [{"title":"","text":""}],
  "process": [{"step_title":"","step_text":""}],
  "faq": [{"q":"","a":""}],
  "seo": {"title":"","description":""}
}
Tone: professional, concise, trustful. Jurisdiction: Russia.
Do not output anything except the JSON object.
`;

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You output only JSON object, no extra commentary.' },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.6,
      max_tokens: 900,
    }),
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    throw new Error(`OpenAI API error: ${resp.status} ${errorText}`);
  }

  const j = await resp.json();
  const text = j?.choices?.[0]?.message?.content || j?.choices?.[0]?.text || '';

  // Try parse strict JSON
  let out = null;
  try {
    out = JSON.parse(text);
  } catch (e) {
    // Try to extract JSON block
    const m = text.match(/\{[\s\S]*\}$/);
    if (m) {
      try {
        out = JSON.parse(m[0]);
      } catch (e2) {
        throw new Error('LLM returned non-JSON');
      }
    } else {
      throw new Error('LLM returned non-JSON');
    }
  }

  return out;
}

/**
 * Process a landing generation job
 * @param {object} job - BullMQ job object
 */
async function processJob(job) {
  const { sessionId, payload } = job.data;
  console.log(`Processing job: ${sessionId}`);
  
  try {
    // Update status to processing
    await updateSession(sessionId, { status: 'processing' });
    
    // Generate content with OpenAI
    const result = await generateWithOpenAI(payload);
    
    // Upload result to S3
    let s3Url = null;
    try {
      s3Url = await uploadJSONToS3(sessionId, result);
    } catch (s3Error) {
      console.error('S3 upload failed, continuing without S3:', s3Error);
      // Continue even if S3 fails
    }
    
    // Update session with result
    await updateSession(sessionId, {
      status: 'completed',
      result,
      s3_url: s3Url,
    });
    
    console.log(`Job completed: ${sessionId}`);
    return { success: true, sessionId };
  } catch (error) {
    console.error(`Job failed: ${sessionId}`, error);
    
    // Update session with error
    await updateSession(sessionId, {
      status: 'failed',
      error_message: error.message,
    });
    
    throw error;
  }
}

// Create worker
const worker = new Worker('landing-generation', processJob, {
  connection,
  concurrency: 5, // Process up to 5 jobs concurrently
  limiter: {
    max: 10, // Max 10 jobs
    duration: 1000, // per second
  },
});

// Worker event handlers
worker.on('completed', (job) => {
  console.log(`✓ Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`✗ Job ${job.id} failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('Worker error:', err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing worker...');
  await worker.close();
  const pool = getPool();
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing worker...');
  await worker.close();
  const pool = getPool();
  await pool.end();
  process.exit(0);
});

console.log('Worker started, waiting for jobs...');

// TODO: Add more sophisticated error handling and retry logic
// TODO: Add job progress reporting
// TODO: Add observability (metrics, tracing)
// TODO: Add support for calling internal /api/generate endpoint if available
// TODO: Add rate limiting per customer/token
// TODO: Add job timeout configuration
