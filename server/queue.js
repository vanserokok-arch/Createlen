// server/queue.js - BullMQ producer for task enqueueing
// Uses BullMQ with Upstash Redis for job queue management
import { Queue } from 'bullmq';

let generationQueue = null;

/**
 * Get or create BullMQ queue instance
 * @returns {Queue} BullMQ queue instance
 */
function getQueue() {
  if (!generationQueue) {
    const REDIS_URL = process.env.REDIS_URL;
    if (!REDIS_URL) {
      console.warn('REDIS_URL not configured - queue operations will fail');
      return null;
    }

    // Parse Redis URL for connection options
    const redisOpts = {
      connection: REDIS_URL,
      // TODO: Add connection retry configuration
      // TODO: Add TLS configuration for secure connections
    };

    generationQueue = new Queue('landing-generation', redisOpts);
    console.log('BullMQ queue initialized');
  }
  return generationQueue;
}

/**
 * Enqueue a generation task
 * @param {string} sessionId - Unique session identifier
 * @param {object} payload - Task payload (brief, page_type, options, etc.)
 * @returns {Promise<object>} Job object with job ID
 */
export async function enqueueGeneration(sessionId, payload = {}) {
  const queue = getQueue();
  if (!queue) throw new Error('Queue not configured - REDIS_URL missing');

  try {
    const job = await queue.add(
      'generate-landing',
      {
        sessionId,
        ...payload,
        enqueuedAt: new Date().toISOString(),
      },
      {
        jobId: sessionId, // Use sessionId as jobId for idempotency
        removeOnComplete: {
          age: 3600 * 24, // Keep completed jobs for 24 hours
          count: 1000, // Keep max 1000 completed jobs
        },
        removeOnFail: {
          age: 3600 * 24 * 7, // Keep failed jobs for 7 days
        },
        attempts: 3, // Retry up to 3 times
        backoff: {
          type: 'exponential',
          delay: 5000, // Start with 5 second delay
        },
        // TODO: Add priority support
        // TODO: Add delay support for scheduled generation
      }
    );

    console.log(`Job enqueued: ${job.id}`);
    return job;
  } catch (err) {
    console.error('Failed to enqueue job:', err.message);
    throw new Error(`Failed to enqueue generation task: ${err.message}`);
  }
}

/**
 * Get job status by session ID
 * @param {string} sessionId - Session identifier (used as job ID)
 * @returns {Promise<object|null>} Job status or null if not found
 */
export async function getJobStatus(sessionId) {
  const queue = getQueue();
  if (!queue) throw new Error('Queue not configured');

  try {
    const job = await queue.getJob(sessionId);
    if (!job) return null;

    const state = await job.getState();
    return {
      id: job.id,
      state,
      progress: job.progress,
      data: job.data,
      returnvalue: job.returnvalue,
      failedReason: job.failedReason,
      // TODO: Add more job metadata
    };
  } catch (err) {
    console.error('Failed to get job status:', err.message);
    return null;
  }
}

/**
 * Close queue connection (for graceful shutdown)
 */
export async function closeQueue() {
  if (generationQueue) {
    await generationQueue.close();
    generationQueue = null;
  }
}

// TODO: Add bulk job enqueueing
// TODO: Add job cancellation functionality
// TODO: Add queue metrics and monitoring
// TODO: Add job priority management
