// worker/worker.js — BullMQ worker for processing landing page generation jobs
import 'dotenv/config';
import { Worker } from 'bullmq';
import OpenAI from 'openai';
import { updateSession } from '../server/db.js';
import { uploadToS3 } from '../server/s3.js';

// TODO: Add job progress tracking
// TODO: Add detailed error reporting
// TODO: Add metrics collection (job duration, success rate)
// TODO: Add graceful shutdown handling
// TODO: Add job timeout configuration
// TODO: Add concurrent job limits

const OPENAI_KEY = process.env.OPENAI_KEY || process.env.OPENAI_API_KEY;
const REDIS_URL = process.env.REDIS_URL;

if (!OPENAI_KEY) {
  console.error('ERROR: OPENAI_KEY/OPENAI_API_KEY not set. Worker cannot start.');
  process.exit(1);
}

if (!REDIS_URL) {
  console.error('ERROR: REDIS_URL not set. Worker cannot start.');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_KEY });

// Parse Upstash Redis URL
function parseRedisUrl(url) {
  const urlObj = new URL(url);
  return {
    host: urlObj.hostname,
    port: parseInt(urlObj.port) || 6379,
    username: urlObj.username || 'default',
    password: urlObj.password,
  };
}

const redisConfig = parseRedisUrl(REDIS_URL);

/**
 * Process a landing page generation job
 * @param {object} job - BullMQ job object
 * @returns {Promise<object>} Job result
 */
async function processGenerationJob(job) {
  const { sessionId, payload } = job.data;
  const { brief = '', page_type = 'invest', model = 'gpt-3.5-turbo' } = payload;

  console.log(`Processing job for session: ${sessionId}`);

  try {
    // Update session status to processing
    await updateSession(sessionId, 'processing');

    // Build prompt for landing page generation
    const systemPrompt = `You are a professional landing page generator for Russian audiences. 
Generate a complete, modern, responsive HTML landing page based on the provided brief.
The page should be visually appealing, have clear call-to-action, and be optimized for conversion.
Include inline CSS and make it mobile-friendly.
Return ONLY the complete HTML code, no explanations.`;

    const userPrompt = `Create a ${page_type} landing page with the following brief:\n\n${brief}`;

    console.log(`Calling OpenAI API with model: ${model}`);

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const htmlContent = response.choices[0]?.message?.content || '';

    if (!htmlContent) {
      throw new Error('OpenAI returned empty content');
    }

    console.log(`Generated HTML (${htmlContent.length} chars) for session: ${sessionId}`);

    // Upload to S3
    console.log(`Uploading to S3 for session: ${sessionId}`);
    const artifactUrl = await uploadToS3(sessionId, htmlContent);

    // Update session with artifact URL
    await updateSession(sessionId, 'completed', artifactUrl);

    console.log(`Job completed successfully for session: ${sessionId}`);
    console.log(`Artifact URL: ${artifactUrl}`);

    return {
      sessionId,
      status: 'completed',
      artifactUrl,
      usage: response.usage,
    };
  } catch (error) {
    console.error(`Job failed for session ${sessionId}:`, error);

    // Update session status to failed
    await updateSession(sessionId, 'failed');

    throw error;
  }
}

// Create worker
const worker = new Worker('landing-generation', processGenerationJob, {
  connection: redisConfig,
  concurrency: 2, // Process 2 jobs concurrently
  limiter: {
    max: 10, // Max 10 jobs per...
    duration: 60000, // ...60 seconds (1 minute)
  },
});

// Worker event handlers
worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('Worker error:', err);
});

// Graceful shutdown
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
console.log(`Concurrency: 2 jobs`);
console.log(`Rate limit: 10 jobs per minute`);
