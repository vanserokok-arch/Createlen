// server/health.js - Health check endpoint for Render and other platforms
import { getPool } from './db.js';
import { getRedisConnection } from './queue.js';

/**
 * Perform health checks on database and Redis connections
 * @returns {Promise<object>} Health check results
 */
export async function checkHealth() {
  const results = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {},
  };

  // In test mode, do lightweight checks
  const isTestMode = process.env.NODE_ENV === 'test' || process.env.VITEST;

  // Check database connection (skip in test mode if not configured)
  if (process.env.DATABASE_URL) {
    try {
      const pool = getPool();
      const result = await pool.query('SELECT 1 as healthy');
      results.checks.database = {
        status: result.rows[0].healthy === 1 ? 'healthy' : 'unhealthy',
        message: 'Database connection successful',
      };
    } catch (error) {
      results.checks.database = {
        status: 'unhealthy',
        message: error.message,
      };
      if (!isTestMode) {
        results.status = 'unhealthy';
      }
    }
  } else if (!isTestMode) {
    results.checks.database = {
      status: 'unhealthy',
      message: 'DATABASE_URL not configured',
    };
    results.status = 'unhealthy';
  }

  // Check Redis connection (skip in test mode if not configured)
  if (process.env.REDIS_URL) {
    try {
      const redis = getRedisConnection();
      const pong = await redis.ping();
      results.checks.redis = {
        status: pong === 'PONG' ? 'healthy' : 'unhealthy',
        message: 'Redis connection successful',
      };
    } catch (error) {
      results.checks.redis = {
        status: 'unhealthy',
        message: error.message,
      };
      if (!isTestMode) {
        results.status = 'unhealthy';
      }
    }
  } else if (!isTestMode) {
    results.checks.redis = {
      status: 'unhealthy',
      message: 'REDIS_URL not configured',
    };
    results.status = 'unhealthy';
  }

  // Check environment variables (required only in production)
  const requiredEnvVars = isTestMode 
    ? ['OPENAI_API_KEY']
    : [
        'OPENAI_API_KEY',
        'DATABASE_URL',
        'REDIS_URL',
        'S3_BUCKET',
        'S3_ACCESS_KEY_ID',
        'S3_SECRET_ACCESS_KEY',
      ];

  const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName] && !process.env[varName.replace('OPENAI_API_KEY', 'OPENAI_KEY')]);
  
  results.checks.environment = {
    status: missingEnvVars.length === 0 ? 'healthy' : 'unhealthy',
    message: missingEnvVars.length === 0 
      ? 'All required environment variables are set'
      : `Missing environment variables: ${missingEnvVars.join(', ')}`,
  };

  if (missingEnvVars.length > 0 && !isTestMode) {
    results.status = 'unhealthy';
  }

  return results;
}

/**
 * Express middleware for health check endpoint
 */
export function healthCheckHandler() {
  return async (req, res) => {
    try {
      const health = await checkHealth();
      const statusCode = health.status === 'healthy' ? 200 : 503;
      
      // Backward compatibility - add simple 'ok' field
      health.ok = health.status === 'healthy';
      
      res.status(statusCode).json(health);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        ok: false,
        timestamp: new Date().toISOString(),
        error: error.message,
      });
    }
  };
}
