// server/queue.js — BullMQ queue setup for task management
// TODO: Add queue monitoring and metrics
// TODO: Implement dead letter queue for failed jobs
// TODO: Add job priority support

import { Queue } from 'bullmq';

const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  console.warn('WARNING: REDIS_URL not set. Queue operations will fail.');
}

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

// Create generation queue
export const generationQueue = new Queue('landing-generation', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
      count: 200, // Keep last 200 failed jobs for debugging
    },
  },
});

/**
 * Add a generation job to the queue
 * @param {string} sessionId - Unique session identifier
 * @param {object} payload - Job payload with brief, page_type, etc.
 * @returns {Promise<object>} Job object
 */
export async function addGenerationJob(sessionId, payload) {
  const job = await generationQueue.add(
    'generate-landing',
    { sessionId, ...payload },
    {
      jobId: sessionId, // Use sessionId as jobId for idempotency
    }
  );
  return job;
}

/**
 * Get job status
 * @param {string} sessionId - Session/job identifier
 * @returns {Promise<object|null>} Job state or null
 */
export async function getJobStatus(sessionId) {
  const job = await generationQueue.getJob(sessionId);
  if (!job) return null;
  
  const state = await job.getState();
  return { state, job };
}
