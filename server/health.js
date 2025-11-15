// server/health.js — Health check endpoint for monitoring and load balancers
// Provides system status and dependency health checks

import { getPool } from './db.js';
import { getQueue } from './queue.js';

/**
 * Health check handler
 * Checks database, queue, and overall system health
 */
export async function healthCheck(req, res) {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    checks: {},
  };

  // Check database connection
  try {
    const pool = getPool();
    const result = await pool.query('SELECT NOW()');
    checks.checks.database = {
      status: 'healthy',
      connected: true,
      timestamp: result.rows[0].now,
    };
  } catch (error) {
    checks.status = 'unhealthy';
    checks.checks.database = {
      status: 'unhealthy',
      connected: false,
      error: error.message,
    };
  }

  // Check Redis/Queue connection
  try {
    const queue = getQueue();
    const jobCounts = await queue.getJobCounts();
    checks.checks.queue = {
      status: 'healthy',
      connected: true,
      jobs: jobCounts,
    };
  } catch (error) {
    checks.status = 'unhealthy';
    checks.checks.queue = {
      status: 'unhealthy',
      connected: false,
      error: error.message,
    };
  }

  // Check OpenAI key configuration
  const openaiKey = process.env.OPENAI_KEY || process.env.OPENAI_API_KEY;
  checks.checks.openai = {
    status: openaiKey ? 'configured' : 'not_configured',
    keyPresent: !!openaiKey,
  };

  // Check S3 configuration
  const s3Configured = !!(
    process.env.S3_BUCKET &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY
  );
  checks.checks.s3 = {
    status: s3Configured ? 'configured' : 'not_configured',
    configured: s3Configured,
  };

  // Set response status code
  const statusCode = checks.status === 'healthy' ? 200 : 503;
  
  res.status(statusCode).json(checks);
}

/**
 * Simple liveness check (minimal overhead)
 * Used by load balancers for quick health verification
 */
export function livenessCheck(req, res) {
  res.status(200).json({ 
    ok: true, 
    timestamp: new Date().toISOString() 
  });
}

/**
 * Readiness check (checks if service is ready to accept traffic)
 */
export async function readinessCheck(req, res) {
  try {
    // Quick database check
    const pool = getPool();
    await pool.query('SELECT 1');
    
    res.status(200).json({ 
      ready: true, 
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    res.status(503).json({ 
      ready: false, 
      error: error.message,
      timestamp: new Date().toISOString() 
    });
  }
}

// TODO: Add memory usage monitoring
// TODO: Add response time metrics
// TODO: Add custom health check thresholds

export default {
  healthCheck,
  livenessCheck,
  readinessCheck,
};
