// server/health.js — Health check endpoint for Render
import express from 'express';

const router = express.Router();

/**
 * Health check endpoint
 * Used by Render for service health monitoring
 * Returns 200 OK if service is healthy
 */
router.get('/health', (req, res) => {
  const health = {
    ok: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  };
  
  // Check if required environment variables are set
  const requiredEnvVars = ['OPENAI_KEY', 'OPENAI_API_KEY'];
  const hasOpenAI = requiredEnvVars.some(key => process.env[key] && process.env[key].trim().length > 0);
  
  if (!hasOpenAI) {
    health.warnings = health.warnings || [];
    health.warnings.push('OpenAI API key not configured');
  }
  
  // Optional: Check database connection
  // Optional: Check Redis connection
  // Optional: Check S3 connectivity
  
  res.status(200).json(health);
});

/**
 * Readiness check endpoint
 * Returns 200 when service is ready to accept traffic
 */
router.get('/ready', (req, res) => {
  // TODO: Add actual readiness checks (DB, Redis, etc.)
  res.status(200).json({ ready: true });
});

/**
 * Liveness check endpoint
 * Returns 200 as long as the process is running
 */
router.get('/alive', (req, res) => {
  res.status(200).json({ alive: true });
});

export default router;

// TODO: Add detailed health checks for database, Redis, and S3
// TODO: Add metrics endpoint for monitoring (e.g., /metrics for Prometheus)
// TODO: Add version information in health response
