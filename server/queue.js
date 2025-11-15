// server/queue.js - BullMQ producer for adding jobs to Redis queue
import { Queue } from 'bullmq';

let landingQueue = null;

/**
 * Get or create the landing generation queue
 * @returns {Queue}
 */
export function getQueue() {
  if (!landingQueue) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL not configured');
    }

    // Parse Redis URL to extract connection info
    const url = new URL(redisUrl);
    const connection = {
      host: url.hostname,
      port: parseInt(url.port || '6379'),
    };

    // Add password if present
    if (url.password) {
      connection.password = url.password;
    }

    // Add username if present
    if (url.username) {
      connection.username = url.username;
    }

    // TLS support for Upstash Redis
    if (url.protocol === 'rediss:') {
      connection.tls = {};
    }

    landingQueue = new Queue('landing-generation', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 1000,    // Keep last 1000 failed jobs
      },
    });
  }
  return landingQueue;
}

/**
 * Add a landing generation job to the queue
 * @param {string} sessionId - Unique session identifier
 * @param {object} jobData - Job data (brief, page_type, etc.)
 * @returns {Promise<object>} - Job instance
 */
export async function addGenerationJob(sessionId, jobData) {
  const queue = getQueue();
  const job = await queue.add(
    'generate',
    {
      sessionId,
      ...jobData,
    },
    {
      jobId: sessionId, // Use sessionId as jobId to prevent duplicates
    }
  );
  return job;
}

/**
 * Get job status by session ID
 * @param {string} sessionId - Session identifier
 * @returns {Promise<object|null>} - Job status or null
 */
export async function getJobStatus(sessionId) {
  const queue = getQueue();
  const job = await queue.getJob(sessionId);
  if (!job) return null;

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
 * Close queue connection (for cleanup)
 */
export async function closeQueue() {
  if (landingQueue) {
    await landingQueue.close();
    landingQueue = null;
  }
}
