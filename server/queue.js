// server/queue.js — BullMQ producer helper for adding jobs to Redis queue
import { Queue } from 'bullmq';

let landingQueue = null;

/**
 * Get or create BullMQ Queue instance
 */
export function getQueue() {
  if (!landingQueue) {
    const REDIS_URL = process.env.REDIS_URL;
    
    if (!REDIS_URL) {
      throw new Error('REDIS_URL environment variable not set');
    }

    // Parse Redis URL for connection options
    const connection = parseRedisUrl(REDIS_URL);

    landingQueue = new Queue('landing-generation', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    });
  }
  return landingQueue;
}

/**
 * Add a job to the queue
 * @param {string} sessionId - Unique session identifier
 * @param {object} payload - Job data (brief, page_type, etc.)
 * @returns {Promise<object>} - Job instance
 */
export async function addGenerationJob(sessionId, payload) {
  const queue = getQueue();
  
  const job = await queue.add(
    'generate-landing',
    {
      sessionId,
      ...payload,
    },
    {
      jobId: sessionId, // Use sessionId as jobId to prevent duplicates
    }
  );

  return job;
}

/**
 * Get job status by sessionId
 * @param {string} sessionId - Session identifier
 * @returns {Promise<object|null>} - Job info or null
 */
export async function getJobStatus(sessionId) {
  const queue = getQueue();
  const job = await queue.getJob(sessionId);
  
  if (!job) return null;

  const state = await job.getState();
  const progress = job.progress;
  
  return {
    id: job.id,
    state,
    progress,
    data: job.data,
    returnvalue: job.returnvalue,
  };
}

/**
 * Parse Redis URL into connection options
 * Supports redis:// and rediss:// (TLS) URLs
 */
function parseRedisUrl(url) {
  const parsed = new URL(url);
  const isTLS = parsed.protocol === 'rediss:';
  
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || (isTLS ? '6380' : '6379'), 10),
    password: parsed.password || undefined,
    username: parsed.username || undefined,
    tls: isTLS ? {} : undefined,
  };
}

/**
 * Close the queue connection (for graceful shutdown)
 */
export async function closeQueue() {
  if (landingQueue) {
    await landingQueue.close();
    landingQueue = null;
  }
}
