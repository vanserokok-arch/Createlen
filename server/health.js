// server/health.js — health check endpoint
import express from 'express';

const router = express.Router();

/**
 * Health check endpoint
 * Checks database connection and returns service status
 */
router.get('/health', async (req, res) => {
  const status = {
    ok: true,
    service: 'createlen',
    timestamp: new Date().toISOString(),
    checks: {},
  };

  // Check database connection (optional - don't fail if DB is not configured)
  try {
    if (process.env.DATABASE_URL) {
      const { getPool } = await import('./db.js');
      const pool = getPool();
      await pool.query('SELECT 1');
      status.checks.database = 'ok';
    } else {
      status.checks.database = 'not configured (optional)';
    }
  } catch (err) {
    // Don't fail health check if database is not available
    status.checks.database = 'warning: ' + err.message;
  }

  // Check environment variables
  const requiredEnvVars = ['OPENAI_KEY', 'OPENAI_API_KEY'];
  const hasOpenAI = requiredEnvVars.some(key => process.env[key]);
  status.checks.openai = hasOpenAI ? 'ok' : 'warning: no API key';

  // Always return 200 for basic health check
  res.status(200).json(status);
});

export default router;
