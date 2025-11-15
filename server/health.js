// server/health.js - Health check endpoint for Render and monitoring
// Returns service status and dependencies health

import { getPool } from './db.js';
import { getQueue } from './queue.js';

/**
 * Check database health
 * @returns {Promise<Object>} Database health status
 */
async function checkDatabase() {
  try {
    const pool = getPool();
    if (!pool) {
      return { status: 'unavailable', message: 'Database not configured' };
    }

    const result = await pool.query('SELECT 1 as health');
    
    return {
      status: 'healthy',
      message: 'Database connection OK',
      responseTime: result.duration || 0,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error.message,
    };
  }
}

/**
 * Check Redis queue health
 * @returns {Promise<Object>} Queue health status
 */
async function checkQueue() {
  try {
    const queue = getQueue();
    if (!queue) {
      return { status: 'unavailable', message: 'Queue not configured' };
    }

    // Check if we can connect to Redis
    await queue.client.ping();
    
    return {
      status: 'healthy',
      message: 'Queue connection OK',
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error.message,
    };
  }
}

/**
 * Check S3 health
 * @returns {Object} S3 health status
 */
function checkS3() {
  const hasCredentials = !!(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
  const hasBucket = !!process.env.S3_BUCKET;

  if (!hasCredentials || !hasBucket) {
    return {
      status: 'unavailable',
      message: 'S3 not configured',
    };
  }

  return {
    status: 'configured',
    message: 'S3 credentials present',
  };
}

/**
 * Check OpenAI API key
 * @returns {Object} OpenAI health status
 */
function checkOpenAI() {
  const hasKey = !!process.env.OPENAI_KEY;

  if (!hasKey) {
    return {
      status: 'unavailable',
      message: 'OpenAI API key not configured',
    };
  }

  return {
    status: 'configured',
    message: 'OpenAI API key present',
  };
}

/**
 * Health check handler
 * Returns overall service health and dependencies status
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
export async function healthCheckHandler(req, res) {
  const startTime = Date.now();

  // Run health checks in parallel
  const [dbHealth, queueHealth] = await Promise.all([
    checkDatabase(),
    checkQueue(),
  ]);

  const s3Health = checkS3();
  const openaiHealth = checkOpenAI();

  // Determine overall status
  const isHealthy = 
    dbHealth.status === 'healthy' &&
    queueHealth.status === 'healthy' &&
    (s3Health.status === 'configured' || s3Health.status === 'unavailable') &&
    (openaiHealth.status === 'configured' || openaiHealth.status === 'unavailable');

  const response = {
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    responseTime: Date.now() - startTime,
    dependencies: {
      database: dbHealth,
      queue: queueHealth,
      s3: s3Health,
      openai: openaiHealth,
    },
  };

  // Return 200 if healthy, 503 if unhealthy
  const statusCode = isHealthy ? 200 : 503;
  res.status(statusCode).json(response);
}

// TODO: Add more health checks:
// - Memory usage
// - CPU usage
// - Disk space
// - API rate limits
