// server/health.js — Health check endpoint for Render
// Provides detailed health status for monitoring and deployment readiness
// TODO: Add dependency health checks (database, Redis, S3)
// TODO: Add custom health metrics
// TODO: Add readiness vs liveness check separation

import express from 'express';
import { isDatabaseConfigured } from './db.js';
import { isQueueConfigured } from './queue.js';
import { isS3Configured } from './s3.js';

const router = express.Router();

/**
 * Basic health check endpoint
 * Returns 200 OK if service is running
 */
router.get('/health', (req, res) => {
  res.json({ 
    ok: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * Detailed health check with dependency status
 * Useful for debugging and monitoring
 */
router.get('/health/detailed', async (req, res) => {
  const health = {
    ok: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    node: process.version,
    environment: process.env.NODE_ENV || 'development',
    dependencies: {
      database: {
        configured: isDatabaseConfigured(),
        // TODO: Add actual connection test
        // connected: await testDatabaseConnection(),
      },
      redis: {
        configured: isQueueConfigured(),
        // TODO: Add actual connection test
        // connected: await testRedisConnection(),
      },
      s3: {
        configured: isS3Configured(),
        // TODO: Add actual S3 access test
        // accessible: await testS3Access(),
      },
      openai: {
        configured: !!(process.env.OPENAI_KEY || process.env.OPENAI_API_KEY),
      },
    },
    memory: {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
    },
  };
  
  // Check if all critical dependencies are configured
  const criticalDeps = [
    health.dependencies.openai.configured,
  ];
  
  // For autonomous mode, also require database and Redis
  const autonomousMode = process.env.AUTONOMOUS_MODE === 'true' || isQueueConfigured();
  if (autonomousMode) {
    criticalDeps.push(
      health.dependencies.database.configured,
      health.dependencies.redis.configured
    );
  }
  
  health.ok = criticalDeps.every(Boolean);
  
  const status = health.ok ? 200 : 503;
  res.status(status).json(health);
});

/**
 * Readiness check - returns 200 when service is ready to accept traffic
 * Useful for Kubernetes/container orchestration
 */
router.get('/health/ready', async (req, res) => {
  // TODO: Add actual readiness checks (e.g., database migrations completed)
  const ready = true;
  
  if (ready) {
    res.json({ ready: true });
  } else {
    res.status(503).json({ ready: false });
  }
});

/**
 * Liveness check - returns 200 if service is alive
 * Used to determine if service should be restarted
 */
router.get('/health/live', (req, res) => {
  res.json({ alive: true });
});

export default router;
