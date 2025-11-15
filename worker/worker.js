// worker/worker.js — BullMQ worker for async landing generation
import 'dotenv/config';
import { Worker } from 'bullmq';
import fetch from 'node-fetch';
import { updateSession } from '../server/db.js';
import { uploadBuffer } from '../server/s3.js';

const OPENAI_KEY = process.env.OPENAI_KEY || process.env.OPENAI_API_KEY;
const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  console.error('REDIS_URL not configured');
  process.exit(1);
}

if (!OPENAI_KEY) {
  console.warn('WARNING: OPENAI_KEY not set');
}

const connection = {
  url: REDIS_URL,
};

/**
 * Process landing generation task
 * @param {object} job - BullMQ job
 */
async function processGeneration(job) {
  const { sessionId, brief, page_type = 'invest' } = job.data;
  
  console.log(`Processing generation for session ${sessionId}`);
  
  try {
    // Update session status to processing
    await updateSession(sessionId, { status: 'processing' });
    
    // Call OpenAI to generate landing content
    const content = await generateWithOpenAI(brief, page_type);
    
    // Create HTML and JSON artifacts
    const html = createLandingHTML(content);
    const json = JSON.stringify(content, null, 2);
    
    // Upload to S3
    // TODO: Consider using a unique key per session (e.g., sessionId/landing.html)
    const timestamp = Date.now();
    const htmlKey = `landings/${sessionId}/landing-${timestamp}.html`;
    const jsonKey = `landings/${sessionId}/landing-${timestamp}.json`;
    
    await uploadBuffer(Buffer.from(html, 'utf-8'), htmlKey, 'text/html');
    const artifactUrl = await uploadBuffer(Buffer.from(json, 'utf-8'), jsonKey, 'application/json');
    
    // Update session with results
    await updateSession(sessionId, {
      status: 'completed',
      payload: content,
      artifact_url: artifactUrl,
    });
    
    console.log(`Completed generation for session ${sessionId}`);
    return { sessionId, artifactUrl, status: 'completed' };
    
  } catch (error) {
    console.error(`Generation failed for session ${sessionId}:`, error);
    
    // Update session status to failed
    await updateSession(sessionId, {
      status: 'failed',
      payload: { error: error.message },
    });
    
    // TODO: Add retry logic and exponential backoff
    // TODO: Add observability (metrics, logs, alerts)
    throw error;
  }
}

/**
 * Generate landing content using OpenAI
 * @param {string} brief - User brief
 * @param {string} page_type - Page type (e.g., 'invest')
 * @returns {Promise<object>} - Generated content JSON
 */
async function generateWithOpenAI(brief, page_type) {
  if (!OPENAI_KEY) {
    throw new Error('OPENAI_KEY not configured');
  }

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

  // Try parse strict JSON; if fail, try to extract JSON block
  let out = null;
  try {
    out = JSON.parse(text);
  } catch (e) {
    const m = text.match(/\{[\s\S]*\}$/);
    if (m) {
      try {
        out = JSON.parse(m[0]);
      } catch (e2) {
        out = null;
      }
    }
  }

  if (!out) {
    throw new Error('OpenAI returned non-JSON response');
  }

  return out;
}

/**
 * Create HTML from landing content
 * @param {object} data - Landing content JSON
 * @returns {string} - HTML string
 */
function createLandingHTML(data) {
  const escapeHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
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

// Create worker instance
const worker = new Worker('landing-generation', processGeneration, {
  connection,
  concurrency: 2, // Process up to 2 jobs concurrently
  limiter: {
    max: 10, // Max 10 jobs
    duration: 60000, // Per 60 seconds
  },
});

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
  // TODO: Add alerting for failed jobs
});

worker.on('error', (err) => {
  console.error('Worker error:', err);
});

console.log('Worker started and listening for jobs...');

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
