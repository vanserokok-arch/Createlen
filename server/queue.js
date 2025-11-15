// server/queue.js — BullMQ Queue producer for async job processing
import { Queue } from 'bullmq';
import Redis from 'ioredis';

let queue = null;
let connection = null;

/**
 * Initialize Redis connection for BullMQ
 * @returns {Redis} Redis connection instance
 */
export function getRedisConnection() {
  if (!connection) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set');
    }
    
    // Parse Redis URL and create connection
    // BullMQ requires ioredis instance
    connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false
    });

    connection.on('error', (err) => {
      console.error('Redis connection error:', err);
    });
  }
  return connection;
}

/**
 * Get or create the BullMQ Queue instance
 * @returns {Queue} BullMQ Queue instance
 */
export function getQueue() {
  if (!queue) {
    const connection = getRedisConnection();
    
    queue = new Queue('landing-generation', {
      connection,
      defaultJobOptions: {
        attempts: 3, // Retry failed jobs up to 3 times
        backoff: {
          type: 'exponential',
          delay: 2000 // Start with 2 second delay
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 200 // Keep last 200 failed jobs
      }
    });
  }
  return queue;
}

/**
 * Add a landing generation job to the queue
 * @param {string} sessionId - Unique session identifier
 * @param {object} payload - Job payload (brief, page_type, token, etc.)
 * @returns {Promise<object>} Job instance
 */
export async function addGenerationJob(sessionId, payload) {
  const queue = getQueue();
  
  const job = await queue.add(
    'generate-landing',
    {
      sessionId,
      ...payload
    },
    {
      jobId: sessionId, // Use sessionId as jobId to prevent duplicates
      removeOnComplete: true,
      removeOnFail: false
    }
  );
  
  console.log(`✓ Job added to queue: ${sessionId}`);
  return job;
}

/**
 * Close queue and Redis connection
 * Call this when shutting down the server
 */
export async function closeQueue() {
  if (queue) {
    await queue.close();
    queue = null;
  }
  if (connection) {
    await connection.quit();
    connection = null;
  }
}
