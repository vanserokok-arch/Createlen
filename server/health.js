// server/health.js — Health check endpoint
// TODO: Add detailed health metrics (CPU, memory, disk)
// TODO: Implement graceful shutdown handlers
// TODO: Add dependency health checks (external APIs)

import { checkHealth as checkDbHealth } from './db.js';

/**
 * Check overall system health
 * @returns {Promise<object>} Health status object
 */
export async function checkSystemHealth() {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {},
  };

  // Check database
  try {
    const dbHealthy = await checkDbHealth();
    health.checks.database = {
      status: dbHealthy ? 'healthy' : 'unhealthy',
      message: dbHealthy ? 'Connected' : 'Connection failed',
    };
    if (!dbHealthy) health.status = 'degraded';
  } catch (err) {
    health.checks.database = {
      status: 'unhealthy',
      message: err.message,
    };
    health.status = 'degraded';
  }

  // Check environment variables
  const requiredEnvVars = [
    'DATABASE_URL',
    'REDIS_URL',
    'OPENAI_API_KEY',
    'S3_BUCKET',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
  ];

  const missingEnvVars = requiredEnvVars.filter(key => !process.env[key] && !process.env[key.replace('OPENAI_API_KEY', 'OPENAI_KEY')]);
  
  health.checks.environment = {
    status: missingEnvVars.length === 0 ? 'healthy' : 'unhealthy',
    message: missingEnvVars.length === 0 
      ? 'All required environment variables set'
      : `Missing: ${missingEnvVars.join(', ')}`,
  };

  if (missingEnvVars.length > 0) {
    health.status = 'degraded';
  }

  return health;
}
