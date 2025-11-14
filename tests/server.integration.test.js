import request from 'supertest';
import { spawn } from 'child_process';

const SERVER_PORT = process.env.PORT || 3000;
const SERVER_URL = `http://127.0.0.1:${SERVER_PORT}`;
let serverProc = null;

beforeAll((done) => {
  // start server in mock mode
  serverProc = spawn('node', ['server.js'], {
    env: { ...process.env, MOCK_OPENAI: 'true', ALLOWED_TOKEN: process.env.ALLOWED_TOKEN || 'test-token' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  // wait for server to be up by polling
  const start = Date.now();
  const check = () => {
    request(SERVER_URL)
      .get('/')
      .timeout(2000)
      .end((err) => {
        if (!err) return done();
        if (Date.now() - start > 15000) return done(new Error('Server did not start in time'));
        setTimeout(check, 200);
      });
  };
  check();
});

afterAll(() => {
  if (serverProc) serverProc.kill();
});

test('POST /generate with body token returns JSON', async () => {
  const res = await request(SERVER_URL)
    .post('/generate')
    .send({ token: process.env.ALLOWED_TOKEN || 'test-token', brief: 'Smoke test brief' })
    .set('Content-Type', 'application/json')
    .expect(200);
  expect(res.body).toHaveProperty('hero');
});

test('Export endpoint returns zip', async () => {
  // generate first
  await request(SERVER_URL)
    .post('/generate')
    .send({ token: process.env.ALLOWED_TOKEN || 'test-token', brief: 'Smoke test', sessionId: 'it-session-1' })
    .set('Content-Type', 'application/json')
    .expect(200);

  // export
  const res = await request(SERVER_URL)
    .get(`/export?sessionId=it-session-1&token=${process.env.ALLOWED_TOKEN || 'test-token'}`)
    .expect(200);
  // response should be binary zip; check header
  expect(res.headers['content-type']).toMatch(/zip/);
});