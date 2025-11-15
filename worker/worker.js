// worker/worker.js — BullMQ worker for processing generation tasks
// TODO: Add job progress reporting for long-running tasks
// TODO: Implement retry strategies with exponential backoff
// TODO: Add observability (metrics, tracing)
// TODO: Ensure idempotency for job processing

import { Worker } from 'bullmq';
import { updateSession } from '../server/db.js';
import { generateLandingContent, contentToHtml } from '../server/generate.js';
import { uploadHtmlToS3, uploadJsonToS3 } from '../server/s3.js';

const REDIS_URL = process.env.REDIS_URL;

// Parse Redis URL for BullMQ connection
function parseRedisUrl(url) {
  if (!url) return { host: 'localhost', port: 6379 };
  
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port, 10) || 6379,
      password: parsed.password || undefined,
      username: parsed.username || undefined,
      tls: parsed.protocol === 'rediss:' ? {} : undefined,
    };
  } catch (err) {
    console.error('Failed to parse REDIS_URL:', err);
    return { host: 'localhost', port: 6379 };
  }
}

const redisConnection = parseRedisUrl(REDIS_URL);

/**
 * Process a landing page generation job
 * @param {object} job - BullMQ job object
 */
async function processGenerationJob(job) {
  const { sessionId, brief, page_type = 'invest' } = job.data;
  
  console.log(`Processing job for session ${sessionId}...`);
  
  try {
    // Update status to processing
    await updateSession(sessionId, 'processing');
    
    // Generate content using OpenAI
    console.log(`Generating content for session ${sessionId}...`);
    const content = await generateLandingContent(brief, page_type);
    
    // Convert to HTML
    const html = contentToHtml(content);
    
    // Upload to S3
    console.log(`Uploading artifacts for session ${sessionId}...`);
    const htmlUrl = await uploadHtmlToS3(sessionId, html);
    await uploadJsonToS3(sessionId, content);
    
    // Update session with artifact URL
    await updateSession(sessionId, 'completed', htmlUrl);
    
    console.log(`✓ Job completed for session ${sessionId}, artifact: ${htmlUrl}`);
    
    return { success: true, artifactUrl: htmlUrl };
  } catch (err) {
    console.error(`✗ Job failed for session ${sessionId}:`, err);
    
    // Update session status to failed
    await updateSession(sessionId, 'failed');
    
    throw err; // Re-throw for BullMQ retry logic
  }
}

/**
 * Start the worker
 */
export async function startWorker() {
  const worker = new Worker('landing-generation', processGenerationJob, {
    connection: redisConnection,
    concurrency: 5, // Process up to 5 jobs concurrently
    limiter: {
      max: 10, // Max 10 jobs
      duration: 60000, // per 60 seconds
    },
  });

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('Worker error:', err);
  });

  console.log('Worker listening for jobs on queue: landing-generation');
  
  return worker;
}

// Start worker if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startWorker().catch((err) => {
    console.error('Failed to start worker:', err);
    process.exit(1);
  });
}
