// server/queue.js — BullMQ queue setup with Upstash Redis
import { Queue } from 'bullmq';

// TODO: Add queue monitoring and metrics
// TODO: Add dead letter queue for failed jobs
// TODO: Add rate limiting configuration
// TODO: Add job priority support

const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  console.warn('WARNING: REDIS_URL not set. Queue functionality will not work.');
}

// Parse Upstash Redis URL
// Format: redis://default:password@host:port
function parseRedisUrl(url) {
  if (!url) return null;
  
  try {
    const urlObj = new URL(url);
    return {
      host: urlObj.hostname,
      port: parseInt(urlObj.port) || 6379,
      username: urlObj.username || 'default',
      password: urlObj.password,
    };
  } catch (error) {
    console.error('Failed to parse REDIS_URL:', error);
    return null;
  }
}

const redisConfig = parseRedisUrl(REDIS_URL);

// Create BullMQ queue for landing page generation
export const landingQueue = redisConfig ? new Queue('landing-generation', {
  connection: redisConfig,
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
      count: 200, // Keep last 200 failed jobs
    },
  },
}) : null;

/**
 * Add a landing page generation job to the queue
 * @param {string} sessionId - Unique session identifier
 * @param {object} payload - Job payload with brief, page_type, etc.
 * @returns {Promise<object>} Job object
 */
export async function addGenerationJob(sessionId, payload) {
  if (!landingQueue) {
    throw new Error('Queue is not initialized. REDIS_URL not configured.');
  }

  const job = await landingQueue.add('generate-landing', {
    sessionId,
    payload,
  }, {
    jobId: sessionId, // Use sessionId as jobId for idempotency
  });

  return job;
}

/**
 * Get job status by session ID
 * @param {string} sessionId - Session identifier
 * @returns {Promise<object|null>} Job status or null
 */
export async function getJobStatus(sessionId) {
  if (!landingQueue) {
    return null;
  }

  const job = await landingQueue.getJob(sessionId);
  if (!job) {
    return null;
  }

  const state = await job.getState();
  return {
    id: job.id,
    state,
    progress: job.progress,
    returnvalue: job.returnvalue,
    failedReason: job.failedReason,
  };
}

/**
 * Health check for queue connection
 * @returns {Promise<boolean>} True if Redis is reachable
 */
export async function checkQueueHealth() {
  if (!landingQueue) {
    return false;
  }

  try {
    await landingQueue.client.ping();
    return true;
  } catch (error) {
    console.error('Queue health check failed:', error);
    return false;
  }
}
