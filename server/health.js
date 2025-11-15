// server/health.js — Health check endpoint for Render
// Provides comprehensive health status for the application

import { getPool } from './db.js';

/**
 * Check database connectivity
 * @returns {Promise<boolean>} true if database is healthy
 */
async function checkDatabase() {
  try {
    const pool = getPool();
    const result = await pool.query('SELECT NOW() as now');
    return result.rows.length > 0;
  } catch (err) {
    console.error('Database health check failed:', err);
    return false;
  }
}

/**
 * Check Redis/Queue connectivity
 * @returns {Promise<boolean>} true if Redis is healthy
 */
async function checkRedis() {
  try {
    // TODO: Implement Redis ping check when queue is initialized
    // For now, just check if REDIS_URL is set
    return !!process.env.REDIS_URL;
  } catch (err) {
    console.error('Redis health check failed:', err);
    return false;
  }
}

/**
 * Check S3 configuration
 * @returns {boolean} true if S3 is configured
 */
function checkS3Config() {
  return !!(
    process.env.S3_BUCKET &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY
  );
}

/**
 * Get overall health status
 * @returns {Promise<object>} Health status object
 */
export async function getHealthStatus() {
  const status = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: 'unknown',
      redis: 'unknown',
      s3: 'unknown',
    },
  };
  
  // Check database
  const dbHealthy = await checkDatabase();
  status.checks.database = dbHealthy ? 'ok' : 'error';
  
  // Check Redis
  const redisHealthy = await checkRedis();
  status.checks.redis = redisHealthy ? 'ok' : 'warning';
  
  // Check S3 configuration
  const s3Configured = checkS3Config();
  status.checks.s3 = s3Configured ? 'ok' : 'warning';
  
  // Overall status
  if (!dbHealthy) {
    status.status = 'error';
  } else if (!redisHealthy || !s3Configured) {
    status.status = 'degraded';
  }
  
  return status;
}

/**
 * Express middleware for health check endpoint
 * @param {object} req - Express request
 * @param {object} res - Express response
 */
export async function healthCheckHandler(req, res) {
  try {
    const health = await getHealthStatus();
    const statusCode = health.status === 'ok' ? 200 : health.status === 'degraded' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (err) {
    console.error('Health check error:', err);
    res.status(503).json({
      status: 'error',
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
}
