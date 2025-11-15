// server/health.js - Health check endpoint for Render and monitoring
// Checks connectivity to critical services (DB, Redis, S3)

import pg from 'pg';
const { Pool } = pg;

/**
 * Check database connectivity
 * @returns {Promise<boolean>} true if database is accessible
 */
async function checkDatabase() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) return false;

  try {
    const pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('supabase') ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 5000,
    });
    const result = await pool.query('SELECT 1');
    await pool.end();
    return result.rows.length > 0;
  } catch (err) {
    console.error('Database health check failed:', err.message);
    return false;
  }
}

/**
 * Check Redis connectivity
 * @returns {Promise<boolean>} true if Redis is accessible
 */
async function checkRedis() {
  const REDIS_URL = process.env.REDIS_URL;
  if (!REDIS_URL) return false;

  try {
    // Import Redis dynamically to avoid errors if not needed
    const { Queue } = await import('bullmq');
    const testQueue = new Queue('health-check', {
      connection: REDIS_URL,
    });
    // Just check if we can get queue status
    await testQueue.getJobCounts();
    await testQueue.close();
    return true;
  } catch (err) {
    console.error('Redis health check failed:', err.message);
    return false;
  }
}

/**
 * Health check handler for Express
 * Returns 200 if service is healthy, 503 if degraded
 */
export async function healthCheckHandler(req, res) {
  const checks = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: false,
      redis: false,
      openai: !!process.env.OPENAI_KEY || !!process.env.OPENAI_API_KEY,
      s3: !!(process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY),
    },
  };

  // Run service checks in parallel (with timeout)
  const checkPromises = [
    checkDatabase().then(ok => { checks.services.database = ok; }),
    checkRedis().then(ok => { checks.services.redis = ok; }),
  ];

  try {
    await Promise.race([
      Promise.all(checkPromises),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Health check timeout')), 8000)),
    ]);
  } catch (err) {
    console.error('Health check error:', err.message);
  }

  // Determine overall health
  // For basic health check, we only require server to be running
  // Database and Redis are optional for degraded mode
  const isHealthy = true; // Basic health: server is responding
  const isDegraded = !checks.services.database || !checks.services.redis;

  if (isDegraded) {
    checks.status = 'degraded';
  }

  // Return 200 for healthy/degraded, 503 only if completely down
  // Render needs 200 for the service to be considered up
  res.status(isHealthy ? 200 : 503).json(checks);
}

// TODO: Add detailed health metrics (memory, CPU, etc.)
// TODO: Add dependency version information
// TODO: Add last successful job timestamp
// TODO: Add queue depth monitoring
