// server/queue.js — BullMQ producer for adding tasks to Redis queue
// Uses BullMQ Queue to enqueue async generation jobs

import { Queue } from 'bullmq';

let landingQueue = null;

/**
 * Get or create the landing generation queue
 * @returns {Queue} BullMQ Queue instance
 */
export function getLandingQueue() {
  if (!landingQueue) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set');
    }
    
    // Parse Redis URL for BullMQ connection
    const connection = parseRedisUrl(redisUrl);
    
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
          count: 1000,
        },
        removeOnFail: {
          age: 604800, // Keep failed jobs for 7 days
        },
      },
    });
    
    landingQueue.on('error', (err) => {
      console.error('Queue error:', err);
    });
  }
  
  return landingQueue;
}

/**
 * Parse Redis URL into connection object for BullMQ
 * @param {string} url - Redis connection URL
 * @returns {object} Connection configuration object
 */
function parseRedisUrl(url) {
  // BullMQ expects connection config, not URL string
  // For Upstash Redis with TLS (rediss://)
  const urlObj = new URL(url);
  
  return {
    host: urlObj.hostname,
    port: parseInt(urlObj.port) || 6379,
    username: urlObj.username || 'default',
    password: urlObj.password || '',
    tls: urlObj.protocol === 'rediss:' ? {} : undefined,
  };
}

/**
 * Add a landing generation job to the queue
 * @param {string} sessionId - Unique session identifier
 * @param {object} payload - Job payload with generation parameters
 * @returns {Promise<object>} Job object
 */
export async function addGenerationJob(sessionId, payload) {
  const queue = getLandingQueue();
  
  const jobData = {
    sessionId,
    brief: payload.brief || '',
    page_type: payload.page_type || 'invest',
    token: payload.token,
    timestamp: new Date().toISOString(),
  };
  
  try {
    const job = await queue.add(
      'generate',
      jobData,
      {
        jobId: sessionId, // Use sessionId as jobId to prevent duplicates
        priority: payload.priority || 10,
      }
    );
    
    console.log(`✓ Job added to queue: ${sessionId}`);
    return job;
  } catch (err) {
    console.error('Error adding job to queue:', err);
    throw err;
  }
}

/**
 * Get job status from the queue
 * @param {string} jobId - Job identifier (same as sessionId)
 * @returns {Promise<object|null>} Job status or null if not found
 */
export async function getJobStatus(jobId) {
  const queue = getLandingQueue();
  
  try {
    const job = await queue.getJob(jobId);
    if (!job) {
      return null;
    }
    
    const state = await job.getState();
    const progress = job.progress;
    
    return {
      id: job.id,
      state,
      progress,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
      returnvalue: job.returnvalue,
    };
  } catch (err) {
    console.error('Error getting job status:', err);
    return null;
  }
}

/**
 * Close the queue connection
 * @returns {Promise<void>}
 */
export async function closeQueue() {
  if (landingQueue) {
    await landingQueue.close();
    landingQueue = null;
  }
}
