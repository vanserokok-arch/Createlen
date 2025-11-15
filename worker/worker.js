// worker/worker.js — BullMQ worker for autonomous landing generation
// This worker processes async tasks from Redis queue
// TODO: Add proper error handling and retry logic
// TODO: Add observability (logging, metrics, tracing)
// TODO: Add graceful shutdown handling

import 'dotenv/config';
import { Worker } from 'bullmq';
import fetch from 'node-fetch';
import { uploadToS3 } from '../server/s3.js';
import { updateSession } from '../server/db.js';

const REDIS_URL = process.env.REDIS_URL;
const OPENAI_KEY = process.env.OPENAI_KEY || process.env.OPENAI_API_KEY;

if (!REDIS_URL) {
  console.error('ERROR: REDIS_URL not set');
  process.exit(1);
}

if (!OPENAI_KEY) {
  console.warn('WARNING: OPENAI_KEY not set, worker may fail to generate content');
}

// Initialize BullMQ worker
const worker = new Worker(
  'landing-generation',
  async (job) => {
    console.log(`Processing job ${job.id} for session ${job.data.sessionId}`);
    
    try {
      const { sessionId, brief, page_type = 'invest', token } = job.data;
      
      // Update session status to processing
      await updateSession(sessionId, { status: 'processing' });
      
      // Option 1: Call internal API if available (preferred for consistency)
      // Option 2: Direct OpenAI call (fallback)
      let result;
      
      // Try calling internal API first
      try {
        const apiUrl = process.env.API_URL || 'http://localhost:3000';
        const response = await fetch(`${apiUrl}/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brief, page_type, sessionId, token }),
        });
        
        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }
        
        result = await response.json();
      } catch (apiError) {
        console.warn('Internal API call failed, using direct OpenAI call:', apiError.message);
        
        // Fallback: Direct OpenAI call
        // TODO: Extract this to a shared module to avoid duplication
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
        
        const resp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: "You output only JSON object, no extra commentary." },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.6,
            max_tokens: 900,
          }),
        });
        
        const j = await resp.json();
        const text = j?.choices?.[0]?.message?.content || "";
        
        // Parse JSON response
        try {
          result = JSON.parse(text);
        } catch (e) {
          const m = text.match(/\{[\s\S]*\}$/);
          if (m) {
            result = JSON.parse(m[0]);
          } else {
            throw new Error('Failed to parse OpenAI response as JSON');
          }
        }
      }
      
      // Upload result to S3
      // TODO: Make S3 upload optional based on configuration
      const s3Key = `landings/${sessionId}/landing.json`;
      const s3Url = await uploadToS3(s3Key, JSON.stringify(result, null, 2), 'application/json');
      
      // Update session with success status
      await updateSession(sessionId, {
        status: 'completed',
        payload: { result, s3_url: s3Url },
      });
      
      console.log(`Job ${job.id} completed successfully`);
      return { success: true, sessionId, s3_url: s3Url };
      
    } catch (error) {
      console.error(`Job ${job.id} failed:`, error);
      
      // Update session with error status
      await updateSession(job.data.sessionId, {
        status: 'failed',
        payload: { error: error.message },
      });
      
      throw error; // Let BullMQ handle retry logic
    }
  },
  {
    connection: {
      url: REDIS_URL,
      maxRetriesPerRequest: null, // Required for BullMQ
    },
    // TODO: Configure retry strategy for production
    // attempts: 3,
    // backoff: {
    //   type: 'exponential',
    //   delay: 5000,
    // },
  }
);

// Worker event handlers
worker.on('completed', (job) => {
  console.log(`Job ${job.id} has completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} has failed with error:`, err.message);
  // TODO: Add alerting/monitoring integration
});

worker.on('error', (err) => {
  console.error('Worker error:', err);
  // TODO: Add error tracking (e.g., Sentry)
});

// Graceful shutdown
// TODO: Implement proper graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing worker...');
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing worker...');
  await worker.close();
  process.exit(0);
});

console.log('Worker started and waiting for jobs...');
