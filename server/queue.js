// server/queue.js — BullMQ producer for enqueuing generation tasks
import { Queue } from 'bullmq';

let queue = null;

function getQueue() {
  if (!queue) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL not configured');
    }

    // Parse Redis URL for BullMQ connection
    const connection = {
      url: redisUrl,
    };

    queue = new Queue('landing-generation', { connection });
  }
  return queue;
}

/**
 * Enqueue a landing generation task
 * @param {string} sessionId - Session identifier
 * @param {object} payload - Task payload (brief, page_type, etc.)
 * @returns {Promise<object>} - BullMQ job object
 */
export async function enqueueGeneration(sessionId, payload) {
  const q = getQueue();
  const job = await q.add('generate', {
    sessionId,
    ...payload,
  }, {
    jobId: sessionId, // Use sessionId as job ID for idempotency
    attempts: 3, // Retry up to 3 times on failure
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2s delay
    },
  });

  console.log(`Enqueued generation job ${job.id} for session ${sessionId}`);
  return job;
}

/**
 * Get job status by sessionId
 * @param {string} sessionId - Session identifier
 * @returns {Promise<object|null>} - Job object or null
 */
export async function getJobStatus(sessionId) {
  const q = getQueue();
  const job = await q.getJob(sessionId);
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
 * Close queue connection
 * Call this on shutdown
 */
export async function closeQueue() {
  if (queue) {
    await queue.close();
    queue = null;
  }
}
