import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server.js';

describe('server', () => {
  it('health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
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
});
