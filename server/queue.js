// server/queue.js - Redis queue producer helper using BullMQ
// Used to add landing page generation jobs to the queue

import { Queue } from 'bullmq';

let generationQueue = null;

/**
 * Initialize BullMQ queue
 * Uses REDIS_URL environment variable for connection
 */
export function initQueue() {
  if (generationQueue) return generationQueue;

  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    console.warn('WARNING: REDIS_URL not set. Queue operations will fail.');
    return null;
  }

  // Parse Redis URL to extract connection options
  const redisConfig = parseRedisUrl(redisUrl);

  generationQueue = new Queue('landing-generation', {
    connection: redisConfig,
    defaultJobOptions: {
      attempts: 3, // Retry failed jobs up to 3 times
      backoff: {
        type: 'exponential',
        delay: 2000, // Start with 2 seconds, then 4s, 8s
      },
      removeOnComplete: {
        age: 86400, // Keep completed jobs for 24 hours
        count: 1000, // Keep max 1000 completed jobs
      },
      removeOnFail: {
        age: 604800, // Keep failed jobs for 7 days
      },
    },
  });

  console.log('Queue initialized: landing-generation');
  return generationQueue;
}

/**
 * Parse Redis URL into connection configuration
 * @param {string} url - Redis connection URL
 * @returns {Object} Redis connection config
 */
function parseRedisUrl(url) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port) || 6379,
      password: parsed.password || undefined,
      username: parsed.username || undefined,
      tls: parsed.protocol === 'rediss:' ? {} : undefined,
    };
  } catch (error) {
    console.error('Failed to parse Redis URL:', error);
    throw error;
  }
}

/**
 * Get queue instance
 * @returns {Queue} BullMQ queue instance
 */
export function getQueue() {
  if (!generationQueue) {
    return initQueue();
  }
  return generationQueue;
}

/**
 * Add a landing page generation job to the queue
 * @param {string} sessionId - Unique session identifier
 * @param {string} brief - User brief for landing page
 * @param {string} pageType - Type of landing page (default: 'invest')
 * @returns {Promise<Object>} Job object
 */
export async function addGenerationJob(sessionId, brief, pageType = 'invest') {
  const queue = getQueue();
  
  if (!queue) {
    throw new Error('Queue not initialized');
  }

  const jobData = {
    sessionId,
    brief,
    pageType,
    timestamp: Date.now(),
  };

  try {
    const job = await queue.add('generate-landing', jobData, {
      jobId: sessionId, // Use sessionId as job ID to prevent duplicates
    });
    
    console.log(`Job added to queue: ${sessionId}`, { jobId: job.id });
    return job;
  } catch (error) {
    console.error('Failed to add job to queue:', error);
    throw error;
  }
}

/**
 * Get job status by session ID
 * @param {string} sessionId - Session identifier
 * @returns {Promise<Object|null>} Job state or null
 */
export async function getJobStatus(sessionId) {
  const queue = getQueue();
  
  if (!queue) {
    throw new Error('Queue not initialized');
  }

  try {
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
      returnvalue: job.returnvalue,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    };
  } catch (error) {
    console.error('Failed to get job status:', error);
    throw error;
  }
}

/**
 * Close queue connection
 */
export async function closeQueue() {
  if (generationQueue) {
    await generationQueue.close();
    generationQueue = null;
    console.log('Queue closed');
  }
}

// TODO: Add more queue operations as needed:
// - removeJob(sessionId)
// - getQueueMetrics()
// - pauseQueue() / resumeQueue()
// - retryFailedJob(sessionId)
