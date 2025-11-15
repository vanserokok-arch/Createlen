// server/index.js — Main Express server
// TODO: Add request rate limiting
// TODO: Implement comprehensive error logging (e.g., Sentry)
// TODO: Add API documentation (Swagger/OpenAPI)
// TODO: Implement request validation middleware

import express from 'express';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { createSession, getSession, updateSession } from './db.js';
import { addGenerationJob } from './queue.js';
import { generateLandingContent, contentToHtml } from './generate.js';
import { checkSystemHealth } from './health.js';

dotenv.config();

const app = express();
app.use(express.json({ limit: '200kb' }));

const ALLOWED_TOKEN = process.env.ALLOWED_TOKEN || '';
const PORT = process.env.PORT || 3000;

// Token validation middleware
function validateToken(req, res, next) {
  const token = req.body?.token || req.query.token || req.headers['x-api-token'];
  
  if (ALLOWED_TOKEN && token !== ALLOWED_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized: invalid token' });
  }
  
  next();
}

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const health = await checkSystemHealth();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (err) {
    res.status(503).json({
      status: 'unhealthy',
      error: err.message,
    });
  }
});

// Generate endpoint - supports both sync and async modes
app.post('/generate', validateToken, async (req, res) => {
  try {
    const { 
      brief, 
      page_type = 'invest', 
      async = false,
      sessionId = randomUUID()
    } = req.body;

    if (!brief || brief.trim().length === 0) {
      return res.status(400).json({ error: 'Brief is required' });
    }

    // Async mode: queue the job and return immediately
    if (async) {
      // Create session record
      await createSession(sessionId, { brief, page_type });
      
      // Add job to queue
      await addGenerationJob(sessionId, { brief, page_type });
      
      return res.json({
        sessionId,
        status: 'queued',
        message: 'Generation job queued. Check status with GET /status/:sessionId',
      });
    }

    // Sync mode: generate immediately and return result
    const content = await generateLandingContent(brief, page_type);
    const html = contentToHtml(content);

    return res.json({
      content,
      html,
      sessionId,
    });
  } catch (err) {
    console.error('Generate error:', err);
    return res.status(500).json({ 
      error: 'Generation failed',
      message: err.message,
    });
  }
});

// Status endpoint - check generation job status
app.get('/status/:sessionId', validateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    return res.json({
      sessionId: session.session_id,
      status: session.status,
      artifactUrl: session.artifact_url,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
    });
  } catch (err) {
    console.error('Status check error:', err);
    return res.status(500).json({ 
      error: 'Status check failed',
      message: err.message,
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Createlen Landing Generator',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      generate: 'POST /generate',
      status: 'GET /status/:sessionId',
    },
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✓ Server listening on port ${PORT}`);
  console.log(`✓ Health check: http://localhost:${PORT}/health`);
});
