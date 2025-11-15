// server/health.js — Health check endpoint for Render and other platforms
import express from 'express';

const router = express.Router();

/**
 * Health check endpoint
 * Returns 200 OK if service is healthy
 * TODO: Add checks for database, Redis, S3 connectivity
 */
router.get('/health', async (req, res) => {
  // Basic health check - service is running
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };

  // TODO: Add optional checks for external dependencies
  // - Database connectivity (try simple query)
  // - Redis connectivity (try ping)
  // - S3 connectivity (optional)

  res.json(health);
});

export default router;
