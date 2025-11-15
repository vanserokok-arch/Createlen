// worker/worker.js - BullMQ worker for background landing page generation
// Processes tasks from Redis queue and generates landing pages using OpenAI
import 'dotenv/config';
import { Worker } from 'bullmq';
import fetch from 'node-fetch';
import { updateSession } from '../server/db.js';
import { uploadJSON, uploadHTML } from '../server/s3.js';

const REDIS_URL = process.env.REDIS_URL;
const OPENAI_KEY = process.env.OPENAI_KEY || process.env.OPENAI_API_KEY;

if (!REDIS_URL) {
  console.error('ERROR: REDIS_URL not configured');
  process.exit(1);
}

if (!OPENAI_KEY) {
  console.error('ERROR: OPENAI_KEY (or OPENAI_API_KEY) not configured');
  process.exit(1);
}

/**
 * Generate landing page content using OpenAI
 * @param {object} payload - Task payload with brief, page_type, etc.
 * @returns {Promise<object>} Generated landing page data
 */
async function generateLanding(payload) {
  const { brief = '', page_type = 'invest' } = payload;

  const userPrompt = `
You are a JSON generator for a Russian law firm's landing page.
Input brief: ${brief}
page_type: ${page_type}
Output ONLY valid JSON with structure:
{
  "hero": {"title":"", "subtitle":"", "cta":""},
  "benefits": [{"title":"","text":""}],
  "process": [{"step_title":"","step_text":""}],
  "faq": [{"q":"","a":""}],
  "seo": {"title":"","description":""}
}
Tone: professional, concise, trustful. Jurisdiction: Russia.
Do not output anything except the JSON object.
`;

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You output only JSON object, no extra commentary.' },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.6,
      max_tokens: 900,
    }),
  });

  const j = await resp.json();
  const text = j?.choices?.[0]?.message?.content || '';

  // Parse JSON response
  let out = null;
  try {
    out = JSON.parse(text);
  } catch (e) {
    // Try to extract JSON from response
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        out = JSON.parse(m[0]);
      } catch (e2) {
        throw new Error('Failed to parse OpenAI response as JSON');
      }
    } else {
      throw new Error('No JSON found in OpenAI response');
    }
  }

  return out;
}

/**
 * Generate HTML from landing page data
 * @param {object} data - Landing page data
 * @returns {string} HTML content
 */
function generateHTML(data) {
  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml((data.seo && data.seo.title) || 'Landing')}</title><meta name="description" content="${escapeHtml((data.seo && data.seo.description) || '')}"></head><body>
  <section style="padding:28px;background:#fff;">
    <h1>${escapeHtml(data.hero?.title || '')}</h1>
    <p>${escapeHtml(data.hero?.subtitle || '')}</p>
    ${data.hero?.cta ? `<p><a href="#" style="display:inline-block;padding:10px 14px;background:#ffb400;color:#111;border-radius:10px;text-decoration:none">${escapeHtml(data.hero.cta)}</a></p>` : ''}
  </section>
  ${(Array.isArray(data.benefits) ? '<section><h2>Преимущества</h2><div>' + data.benefits.map(b => `<div><strong>${escapeHtml(b.title)}</strong><p>${escapeHtml(b.text)}</p></div>`).join('') + '</div></section>' : '')}
  ${(Array.isArray(data.faq) ? '<section><h2>FAQ</h2>' + data.faq.map(q => `<details><summary>${escapeHtml(q.q)}</summary><div>${escapeHtml(q.a)}</div></details>`).join('') + '</section>' : '')}
  </body></html>`;
}

/**
 * Process a generation job
 * @param {object} job - BullMQ job object
 * @returns {Promise<object>} Job result
 */
async function processJob(job) {
  const { sessionId, brief, page_type, ...rest } = job.data;

  console.log(`Processing job ${job.id} for session ${sessionId}`);

  try {
    // Update session status to 'processing'
    await updateSession(sessionId, { status: 'processing' });

    // Generate landing page content
    const landingData = await generateLanding({ brief, page_type, ...rest });

    // Generate HTML
    const html = generateHTML(landingData);

    // Upload to S3
    const timestamp = Date.now();
    const jsonKey = `sessions/${sessionId}/landing-${timestamp}.json`;
    const htmlKey = `sessions/${sessionId}/landing-${timestamp}.html`;

    const [jsonUrl, htmlUrl] = await Promise.all([
      uploadJSON(landingData, jsonKey),
      uploadHTML(html, htmlKey),
    ]);

    // Update session with results
    await updateSession(sessionId, {
      status: 'completed',
      artifact_url: htmlUrl,
      payload: {
        brief,
        page_type,
        jsonUrl,
        htmlUrl,
        data: landingData,
      },
    });

    console.log(`Job ${job.id} completed successfully`);
    return { success: true, htmlUrl, jsonUrl };
  } catch (err) {
    console.error(`Job ${job.id} failed:`, err.message);

    // Update session status to 'failed'
    try {
      await updateSession(sessionId, {
        status: 'failed',
        payload: { brief, page_type, error: err.message },
      });
    } catch (updateErr) {
      console.error('Failed to update session status:', updateErr.message);
    }

    throw err; // Re-throw for BullMQ retry logic
  }
}

// Create worker
const worker = new Worker('landing-generation', processJob, {
  connection: REDIS_URL,
  concurrency: 2, // Process 2 jobs concurrently
  // TODO: Add rate limiting for OpenAI API
  // TODO: Add job timeout configuration
  // TODO: Add custom error handling for specific error types
});

worker.on('completed', (job) => {
  console.log(`Job ${job.id} has completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job.id} has failed with error:`, err.message);
  // TODO: Add alerting/monitoring integration
  // TODO: Add retry logic customization
});

worker.on('error', (err) => {
  console.error('Worker error:', err);
  // TODO: Add observability/monitoring
});

console.log('Worker started and waiting for jobs...');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing worker...');
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing worker...');
  await worker.close();
  process.exit(0);
});

// TODO: Add worker metrics endpoint
// TODO: Add job progress reporting
// TODO: Implement dead letter queue for permanently failed jobs
// TODO: Add support for different generation strategies (fast/quality modes)
