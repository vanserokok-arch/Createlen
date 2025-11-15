// server/queue.js — BullMQ producer helper for adding tasks to Redis queue
import { Queue } from 'bullmq';

let queue = null;

/**
 * Get or create BullMQ queue instance
 */
export function getQueue() {
  if (!queue) {
    const REDIS_URL = process.env.REDIS_URL;
    if (!REDIS_URL) {
      throw new Error('REDIS_URL environment variable is not set');
    }
    
    // Parse Redis URL to extract connection options
    const redisUrl = new URL(REDIS_URL);
    const connection = {
      host: redisUrl.hostname,
      port: parseInt(redisUrl.port) || 6379,
      password: redisUrl.password || undefined,
      tls: redisUrl.protocol === 'rediss:' ? {} : undefined,
    };
    
    queue = new Queue('landing-generation', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 24 * 3600, // Keep completed jobs for 24 hours
          count: 1000,
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // Keep failed jobs for 7 days
        },
      },
    });
    
    console.log('BullMQ queue initialized');
  }
  return queue;
}

/**
 * Add a landing generation task to the queue
 * @param {string} sessionId - Unique session identifier
 * @param {object} payload - Task payload (brief, page_type, etc.)
 * @returns {Promise<object>} Job object
 */
export async function addGenerationTask(sessionId, payload) {
  const queue = getQueue();
  
  try {
    const job = await queue.add(
      'generate-landing',
      {
        sessionId,
        payload,
      },
      {
        jobId: sessionId, // Use sessionId as job ID for idempotency
      }
    );
    
    console.log(`Task added to queue: ${sessionId}`);
    return job;
  } catch (error) {
    console.error('Add task error:', error);
    throw error;
  }
}

/**
 * Get job status by session ID
 * @param {string} sessionId - Session identifier
 * @returns {Promise<object|null>} Job status or null if not found
 */
export async function getJobStatus(sessionId) {
  const queue = getQueue();
  
  try {
    const job = await queue.getJob(sessionId);
    if (!job) {
      return null;
    }
    
    const state = await job.getState();
    return {
      id: job.id,
      state,
      progress: job.progress,
      attemptsMade: job.attemptsMade,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
    };
  } catch (error) {
    console.error('Get job status error:', error);
    throw error;
  }
}

/**
 * Close queue connection
 */
export async function closeQueue() {
  if (queue) {
    await queue.close();
    queue = null;
  }
}

// TODO: Add support for job prioritization
// TODO: Add queue metrics and monitoring
// TODO: Add dead letter queue for permanently failed jobs
// TODO: Add batch job processing support
