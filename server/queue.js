// server/queue.js - BullMQ Queue producer for async task processing
import { Queue } from 'bullmq';
import Redis from 'ioredis';

let connection;
let landingQueue;

/**
 * Initialize Redis connection for BullMQ
 * Uses REDIS_URL environment variable
 */
export function getRedisConnection() {
  if (!connection) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is required');
    }

    // Parse Redis URL for BullMQ compatibility
    connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    connection.on('error', (err) => {
      console.error('Redis connection error:', err);
    });

    connection.on('connect', () => {
      console.log('✅ Connected to Redis');
    });
  }
  return connection;
}

/**
 * Get or create BullMQ Queue instance
 * @returns {Queue} BullMQ Queue instance
 */
export function getQueue() {
  if (!landingQueue) {
    const connection = getRedisConnection();
    landingQueue = new Queue('landing-generation', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 86400, // Keep completed jobs for 24 hours
          count: 100,
        },
        removeOnFail: {
          age: 604800, // Keep failed jobs for 7 days
        },
      },
    });
  }
  return landingQueue;
}

/**
 * Add a landing generation job to the queue
 * @param {string} sessionId - Unique session identifier
 * @param {object} payload - Job payload (brief, page_type, token, etc.)
 * @returns {Promise<object>} Job object
 */
export async function addGenerationJob(sessionId, payload) {
  const queue = getQueue();
  
  // TODO: Add job priority based on user tier or other criteria
  const job = await queue.add(
    'generate-landing',
    {
      sessionId,
      ...payload,
    },
    {
      jobId: sessionId, // Use sessionId as jobId for idempotency
      priority: payload.priority || 1,
    }
  );

  return job;
}

/**
 * Get job status by session ID
 * @param {string} sessionId - Session identifier (also jobId)
 * @returns {Promise<object|null>} Job status or null if not found
 */
export async function getJobStatus(sessionId) {
  const queue = getQueue();
  const job = await queue.getJob(sessionId);
  
  if (!job) {
    return null;
  }

  const state = await job.getState();
  const progress = job.progress;

  return {
    id: job.id,
    state,
    progress,
    data: job.data,
    returnValue: job.returnvalue,
    failedReason: job.failedReason,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
  };
}

/**
 * Close queue and Redis connection
 * Call this on graceful shutdown
 */
export async function closeQueue() {
  if (landingQueue) {
    await landingQueue.close();
    landingQueue = null;
  }
  if (connection) {
    await connection.quit();
    connection = null;
  }
}
