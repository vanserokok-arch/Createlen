// worker/worker.js — BullMQ Worker for autonomous landing generation
// This worker processes async generation jobs from Redis queue
import 'dotenv/config';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import fetch from 'node-fetch';
import { updateSession } from '../server/db.js';
import { uploadJsonResult } from '../server/s3.js';

const OPENAI_KEY = process.env.OPENAI_KEY || process.env.OPENAI_API_KEY;
const REDIS_URL = process.env.REDIS_URL;

if (!OPENAI_KEY) {
  console.error('ERROR: OPENAI_KEY or OPENAI_API_KEY not set');
  process.exit(1);
}

if (!REDIS_URL) {
  console.error('ERROR: REDIS_URL not set');
  process.exit(1);
}

// Create Redis connection for worker
const connection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

/**
 * Generate landing content using OpenAI
 * This replicates the logic from server.js /generate endpoint
 * TODO: Extract to shared module to avoid duplication
 */
async function generateLanding(brief, pageType = 'invest') {
  const userPrompt = `
You are a JSON generator for a Russian law firm's landing page.
Input brief: ${brief}
page_type: ${pageType}
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
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You output only JSON object, no extra commentary.' },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.6,
      max_tokens: 900
    })
  });

  if (!resp.ok) {
    throw new Error(`OpenAI API error: ${resp.status} ${resp.statusText}`);
  }

  const j = await resp.json();
  const text = j?.choices?.[0]?.message?.content || '';

  // Parse JSON from response
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
        throw new Error('Failed to parse JSON from OpenAI response');
      }
    } else {
      throw new Error('No JSON found in OpenAI response');
    }
  }

  return out;
}

// Create BullMQ Worker
const worker = new Worker(
  'landing-generation',
  async (job) => {
    const { sessionId, brief, page_type } = job.data;
    
    console.log(`Processing job ${sessionId}...`);
    
    try {
      // Update session status to processing
      await updateSession(sessionId, 'processing');
      
      // Generate landing content
      const result = await generateLanding(brief, page_type);
      
      // Upload result to S3 and get presigned URL
      const resultUrl = await uploadJsonResult(sessionId, result);
      
      // Update session with completed status and result URL
      await updateSession(sessionId, 'completed', resultUrl);
      
      console.log(`✓ Job ${sessionId} completed successfully`);
      
      return { success: true, resultUrl };
    } catch (err) {
      console.error(`✗ Job ${sessionId} failed:`, err.message);
      
      // Update session status to failed
      await updateSession(sessionId, 'failed');
      
      throw err; // Let BullMQ handle retries
    }
  },
  {
    connection,
    concurrency: 2, // Process up to 2 jobs concurrently
    limiter: {
      max: 10, // Max 10 jobs per duration
      duration: 60000 // per 60 seconds (rate limiting)
    }
  }
);

// Worker event handlers
worker.on('completed', (job) => {
  console.log(`Job ${job.id} has completed`);
});

worker.on('failed', (job, err) => {
  console.log(`Job ${job.id} has failed with error: ${err.message}`);
});

worker.on('error', (err) => {
  console.error('Worker error:', err);
});

console.log('🚀 Worker started and waiting for jobs...');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing worker...');
  await worker.close();
  await connection.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing worker...');
  await worker.close();
  await connection.quit();
  process.exit(0);
});
