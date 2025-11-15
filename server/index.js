// server/index.js — Main server entry point with async generation support
import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { performHealthCheck, livenessProbe, readinessProbe } from './health.js';
import { generate, getGenerationStatus } from './generate.js';

// TODO: Add request logging middleware
// TODO: Add rate limiting per API key
// TODO: Add CORS configuration
// TODO: Add API documentation (Swagger/OpenAPI)
// TODO: Add request validation middleware
// TODO: Add authentication middleware

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '1mb' }));

// Serve static files from parent directory (for backward compatibility)
app.use(express.static(path.join(__dirname, '..')));

// Token validation helper
const ALLOWED_TOKEN = process.env.ALLOWED_TOKEN || '';
function checkToken(req) {
  const token = req.headers['x-api-token'] || req.body?.token || req.query.token || '';
  return !ALLOWED_TOKEN || token === ALLOWED_TOKEN;
}

// Health check endpoints
app.get('/health', (req, res) => {
  res.json(livenessProbe());
});

app.get('/health/ready', async (req, res) => {
  const readiness = await readinessProbe();
  const statusCode = readiness.status === 'ready' ? 200 : 503;
  res.status(statusCode).json(readiness);
});

app.get('/health/detailed', async (req, res) => {
  const health = await performHealthCheck();
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Legacy /generate endpoint (sync mode by default, supports async)
app.post('/generate', async (req, res) => {
  try {
    // Check authentication
    if (!checkToken(req)) {
      return res.status(401).json({ error: 'Unauthorized: invalid token' });
    }

    const { brief, page_type, model, async = false } = req.body;

    if (!brief) {
      return res.status(400).json({ error: 'Brief is required' });
    }

    const params = { brief, page_type, model };
    const result = await generate(params, async);

    res.json(result);
  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// New API endpoints
app.post('/api/generate', async (req, res) => {
  try {
    if (!checkToken(req)) {
      return res.status(401).json({ error: 'Unauthorized: invalid token' });
    }

    const { brief, page_type = 'invest', model = 'gpt-3.5-turbo', async = false } = req.body;

    if (!brief) {
      return res.status(400).json({ error: 'Brief is required' });
    }

    const params = { brief, page_type, model };
    const result = await generate(params, async);

    res.json(result);
  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get generation status
app.get('/api/status/:sessionId', async (req, res) => {
  try {
    if (!checkToken(req)) {
      return res.status(401).json({ error: 'Unauthorized: invalid token' });
    }

    const { sessionId } = req.params;
    const status = await getGenerationStatus(sessionId);

    if (!status) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(status);
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API endpoint: http://localhost:${PORT}/api/generate`);
});

export default app;
