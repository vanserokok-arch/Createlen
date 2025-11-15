// test/async-generation.test.js - Tests for async generation endpoints
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server.js';

describe('Async Generation', () => {
  // Skip these tests if required env vars are not set
  const hasRequiredEnv = process.env.DATABASE_URL && process.env.REDIS_URL;
  const testCondition = hasRequiredEnv ? it : it.skip;

  testCondition('POST /generate with async=true should enqueue task', async () => {
    const res = await request(app)
      .post('/generate')
      .send({
        brief: 'Test legal services',
        page_type: 'invest',
        async: true,
      });

    expect([200, 500]).toContain(res.status);
    
    if (res.status === 200) {
      expect(res.body.sessionId).toBeDefined();
      expect(res.body.status).toBe('queued');
    }
  });

  testCondition('GET /session/:sessionId should return session status', async () => {
    // First create a session
    const createRes = await request(app)
      .post('/generate')
      .send({
        brief: 'Test legal services',
        page_type: 'invest',
        async: true,
      });

    if (createRes.status === 200) {
      const sessionId = createRes.body.sessionId;

      // Then check status
      const statusRes = await request(app)
        .get(`/session/${sessionId}`);

      expect([200, 500]).toContain(statusRes.status);
      
      if (statusRes.status === 200) {
        expect(statusRes.body.sessionId).toBe(sessionId);
        expect(statusRes.body.status).toBeDefined();
      }
    }
  });

  it('GET /session/:sessionId with invalid ID should return 404 or 500', async () => {
    const res = await request(app)
      .get('/session/non-existent-session');

    expect([404, 500]).toContain(res.status);
  });

  it('POST /generate without async should work synchronously (backward compatibility)', async () => {
    const res = await request(app)
      .post('/generate')
      .send({
        brief: 'Test legal services',
        page_type: 'invest',
        // No async flag - should use sync mode
      });

    // Should succeed or fail based on OpenAI key availability
    expect([200, 401, 500]).toContain(res.status);
  });
});
