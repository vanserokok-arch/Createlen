// server/health.js — Health check endpoints
import { checkDbHealth } from './db.js';
import { checkQueueHealth } from './queue.js';
import { checkS3Health } from './s3.js';

/**
 * Perform comprehensive health check
 * @returns {Promise<object>} Health status of all services
 */
export async function performHealthCheck() {
  const checks = await Promise.allSettled([
    checkDbHealth(),
    checkQueueHealth(),
    checkS3Health(),
  ]);

  const [dbResult, queueResult, s3Result] = checks;

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: {
        status: dbResult.status === 'fulfilled' && dbResult.value ? 'healthy' : 'unhealthy',
        available: dbResult.status === 'fulfilled' ? dbResult.value : false,
      },
      queue: {
        status: queueResult.status === 'fulfilled' && queueResult.value ? 'healthy' : 'unhealthy',
        available: queueResult.status === 'fulfilled' ? queueResult.value : false,
      },
      s3: {
        status: s3Result.status === 'fulfilled' && s3Result.value ? 'healthy' : 'unhealthy',
        available: s3Result.status === 'fulfilled' ? s3Result.value : false,
      },
    },
  };

  // Overall status is unhealthy if any critical service is down
  if (!health.services.database.available || !health.services.queue.available) {
    health.status = 'unhealthy';
  }

  return health;
}

/**
 * Simple liveness probe
 * @returns {object} Basic health status
 */
export function livenessProbe() {
  return {
    status: 'alive',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Readiness probe - checks if service is ready to accept traffic
 * @returns {Promise<object>} Readiness status
 */
export async function readinessProbe() {
  const dbHealthy = await checkDbHealth();
  const queueHealthy = await checkQueueHealth();

  const ready = dbHealthy && queueHealthy;

  return {
    status: ready ? 'ready' : 'not ready',
    timestamp: new Date().toISOString(),
    checks: {
      database: dbHealthy,
      queue: queueHealthy,
    },
  };
}
