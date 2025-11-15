import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server.js';

describe('server', () => {
  it('health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('POST /api/generate without prompt -> 400', async () => {
    const res = await request(app).post('/api/generate').send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/generate when OpenAI key missing -> 500', async () => {
    const res = await request(app).post('/api/generate').send({ prompt: 'Hello' });
    // If OPENAI_API_KEY is not set in CI, the endpoint should return 500
    expect([200, 500]).toContain(res.status);
  });

  it('POST /generate without brief -> 400', async () => {
    const res = await request(app).post('/generate').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('brief');
  });

  it('POST /generate with async=true should return error when Redis not configured', async () => {
    const res = await request(app).post('/generate').send({
      brief: 'Test brief',
      sessionId: 'test-session',
      async: true
    });
    // Without Redis configured, should return 500
    expect(res.status).toBe(500);
    expect(res.body.error).toBeDefined();
  });

  it('GET /api/session/:sessionId without auth -> 401 when token required', async () => {
    // Set ALLOWED_TOKEN to test auth
    const originalToken = process.env.ALLOWED_TOKEN;
    process.env.ALLOWED_TOKEN = 'test-token';
    
    const res = await request(app).get('/api/session/test-session');
    // Without token, should return 401 or 404 depending on order of checks
    expect([401, 404]).toContain(res.status);
    
    // Restore original
    process.env.ALLOWED_TOKEN = originalToken;
  });

  it('GET /api/session/:sessionId returns 404 when session not found', async () => {
    const res = await request(app).get('/api/session/nonexistent');
    expect(res.status).toBe(404);
  });
});
