// server/health.js - Health check endpoint
import express from 'express';

const router = express.Router();

/**
 * Health check endpoint
 * Returns system status and checks critical services
 */
router.get('/health', async (req, res) => {
  const health = {
    ok: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {},
  };

  // Check database connection (if DATABASE_URL is configured)
  if (process.env.DATABASE_URL) {
    try {
      const { query } = await import('./db.js');
      await query('SELECT 1');
      health.services.database = 'ok';
    } catch (err) {
      health.ok = false;
      health.services.database = 'error';
      health.services.databaseError = err.message;
    }
  }

  // Check Redis connection (if REDIS_URL is configured)
  if (process.env.REDIS_URL) {
    try {
      const { getQueue } = await import('./queue.js');
      const queue = getQueue();
      await queue.client.ping();
      health.services.redis = 'ok';
    } catch (err) {
      health.ok = false;
      health.services.redis = 'error';
      health.services.redisError = err.message;
    }
  }

  // Check S3 configuration (basic check)
  if (process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY) {
    health.services.s3 = 'configured';
  }

  // Check OpenAI key
  if (process.env.OPENAI_KEY || process.env.OPENAI_API_KEY) {
    health.services.openai = 'configured';
  }

  const status = health.ok ? 200 : 503;
  res.status(status).json(health);
});

export default router;
