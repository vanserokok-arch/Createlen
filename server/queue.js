// server/queue.js — BullMQ queue producer helper
// Adds jobs to Redis queue for async processing by worker
// TODO: Add job priority support
// TODO: Add job scheduling support
// TODO: Add bulk job operations

import { Queue } from 'bullmq';

const REDIS_URL = process.env.REDIS_URL;

let queue = null;

/**
 * Get or create the BullMQ queue instance
 * @returns {Queue}
 */
function getQueue() {
  if (!queue) {
    if (!REDIS_URL) {
      throw new Error('REDIS_URL not configured');
    }
    
    queue = new Queue('landing-generation', {
      connection: {
        url: REDIS_URL,
        maxRetriesPerRequest: null, // Required for BullMQ
      },
      // TODO: Configure default job options
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 86400, // Keep completed jobs for 24 hours
          count: 1000, // Keep last 1000 completed jobs
        },
        removeOnFail: {
          age: 604800, // Keep failed jobs for 7 days
        },
      },
    });
  }
  
  return queue;
}

/**
 * Add a landing generation job to the queue
 * @param {string} sessionId - Unique session identifier
 * @param {string} brief - User brief/description
 * @param {string} page_type - Page type (e.g., 'invest')
 * @param {string} token - Authentication token
 * @returns {Promise<object>} - Job information
 */
export async function addGenerationJob(sessionId, brief, page_type = 'invest', token = '') {
  const q = getQueue();
  
  try {
    const job = await q.add(
      'generate-landing',
      {
        sessionId,
        brief,
        page_type,
        token,
        timestamp: Date.now(),
      },
      {
        jobId: sessionId, // Use sessionId as jobId for idempotency
        // TODO: Add custom job options based on priority
      }
    );
    
    console.log(`Job added to queue: ${job.id}`);
    return {
      jobId: job.id,
      sessionId,
      status: 'queued',
    };
  } catch (error) {
    console.error('Failed to add job to queue:', error);
    throw new Error(`Failed to queue job: ${error.message}`);
  }
}

/**
 * Get job status by session ID
 * @param {string} sessionId - Session identifier
 * @returns {Promise<object|null>} - Job status or null if not found
 */
export async function getJobStatus(sessionId) {
  const q = getQueue();
  
  try {
    const job = await q.getJob(sessionId);
    
    if (!job) {
      return null;
    }
    
    const state = await job.getState();
    const progress = job.progress;
    
    return {
      jobId: job.id,
      sessionId: job.data.sessionId,
      state, // 'waiting', 'active', 'completed', 'failed', etc.
      progress,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      returnvalue: job.returnvalue,
      failedReason: job.failedReason,
    };
  } catch (error) {
    console.error('Failed to get job status:', error);
    return null;
  }
}

/**
 * Check if queue is configured
 * @returns {boolean}
 */
export function isQueueConfigured() {
  return !!REDIS_URL;
}

/**
 * Close queue connection
 * Call this on application shutdown
 */
export async function closeQueue() {
  if (queue) {
    await queue.close();
    queue = null;
    console.log('Queue connection closed');
  }
}

// TODO: Add function to pause/resume queue
// TODO: Add function to retry failed jobs
// TODO: Add function to clean old jobs
// TODO: Add queue metrics and monitoring
