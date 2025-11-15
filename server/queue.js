// server/queue.js — BullMQ producer for enqueueing generation jobs
// Uses Upstash Redis for reliable job queue management

import { Queue } from 'bullmq';
import { createConnection } from './redis-connection.js';

let generationQueue = null;

/**
 * Initialize BullMQ queue
 * @returns {Queue} BullMQ queue instance
 */
export function initQueue() {
  if (generationQueue) return generationQueue;

  const connection = createConnection();
  
  generationQueue = new Queue('landing-generation', {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 3600, // Keep completed jobs for 1 hour
        count: 1000,
      },
      removeOnFail: {
        age: 86400, // Keep failed jobs for 24 hours
      },
    },
  });

  return generationQueue;
}

/**
 * Get queue instance
 */
export function getQueue() {
  if (!generationQueue) {
    return initQueue();
  }
  return generationQueue;
}

/**
 * Add generation job to queue
 * @param {string} sessionId - Unique session identifier
 * @param {Object} payload - Job payload
 * @returns {Promise<Object>} Job object
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
      priority: payload.priority || 10,
    }
  );

  return {
    jobId: job.id,
    sessionId,
    status: 'queued',
  };
}

/**
 * Get job status
 * @param {string} jobId - Job identifier
 * @returns {Promise<Object|null>} Job status or null if not found
 */
export async function getJobStatus(jobId) {
  const queue = getQueue();
  const job = await queue.getJob(jobId);
  
  if (!job) return null;

  const state = await job.getState();
  const progress = job.progress;

  return {
    jobId: job.id,
    status: state,
    progress,
    data: job.data,
    failedReason: job.failedReason,
    finishedOn: job.finishedOn,
    processedOn: job.processedOn,
  };
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

// TODO: Add job cancellation support
// TODO: Add bulk job operations
// TODO: Add job priority customization based on user tier
// TODO: Add metrics collection for queue performance

export default {
  initQueue,
  getQueue,
  addGenerationJob,
  getJobStatus,
  closeQueue,
};
