// server/health.js — Health check endpoint for Render and monitoring
import express from 'express';

const router = express.Router();

/**
 * Basic health check endpoint
 * Returns 200 OK if service is running
 * TODO: Add database and Redis connectivity checks for production
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * Detailed health check with dependency status
 * TODO: Implement checks for:
 * - Database connectivity (Postgres)
 * - Redis connectivity
 * - S3 access
 * - OpenAI API availability
 */
router.get('/health/detailed', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: 'not_implemented',
      redis: 'not_implemented',
      s3: 'not_implemented',
      openai: 'not_implemented'
    }
  };

  // TODO: Implement actual health checks
  // For now, return basic info
  res.status(200).json(health);
});

export default router;
