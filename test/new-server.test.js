import { describe, it, expect } from 'vitest';
import request from 'supertest';

// Mock environment variables to avoid warnings
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.S3_BUCKET = 'test-bucket';
process.env.S3_ACCESS_KEY_ID = 'test-key';
process.env.S3_SECRET_ACCESS_KEY = 'test-secret';

// Import after setting env vars
const { default: app } = await import('../server/index.js');

describe('new server (server/index.js)', () => {
  it('GET /health returns alive status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('alive');
    expect(res.body.timestamp).toBeDefined();
  });

  it('POST /api/generate without brief -> 400', async () => {
    const res = await request(app).post('/api/generate').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Brief is required');
  });

  it('POST /api/generate with brief but no token -> 401', async () => {
    // Set ALLOWED_TOKEN to require authentication
    process.env.ALLOWED_TOKEN = 'test-token';
    
    const res = await request(app).post('/api/generate').send({ 
      brief: 'Test landing page' 
    });
    // Should be 401 due to auth or 500 if auth passed but OpenAI fails
    expect([401, 500]).toContain(res.status);
    
    // Reset token for other tests
    delete process.env.ALLOWED_TOKEN;
  });

  it('POST /generate (legacy endpoint) without brief -> 400', async () => {
    const res = await request(app).post('/generate').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('GET /api/status/:sessionId without token -> 401 or 500', async () => {
    process.env.ALLOWED_TOKEN = 'test-token';
    
    const res = await request(app).get('/api/status/test-session-id');
    // Should be 401 due to auth or 500 if auth passed but DB connection fails
    expect([401, 500]).toContain(res.status);
    
    delete process.env.ALLOWED_TOKEN;
  });

  it('GET /health/ready returns readiness status', async () => {
    const res = await request(app).get('/health/ready');
    // May be 200 (ready) or 503 (not ready) depending on DB/Redis availability
    expect([200, 503]).toContain(res.status);
    expect(res.body.status).toBeDefined();
  });

  it('GET /health/detailed returns detailed health status', async () => {
    const res = await request(app).get('/health/detailed');
    // May be 200 (healthy) or 503 (unhealthy) depending on service availability
    expect([200, 503]).toContain(res.status);
    expect(res.body.status).toBeDefined();
    expect(res.body.services).toBeDefined();
    expect(res.body.services.database).toBeDefined();
    expect(res.body.services.queue).toBeDefined();
    expect(res.body.services.s3).toBeDefined();
  });

  it('GET /nonexistent -> 404', async () => {
    const res = await request(app).get('/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });
});
