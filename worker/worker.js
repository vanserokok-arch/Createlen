// worker/worker.js - BullMQ worker for async landing generation
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
  console.warn('WARNING: OPENAI_KEY/OPENAI_API_KEY not set');
}

// Parse Redis URL
const url = new URL(REDIS_URL);
const connection = {
  host: url.hostname,
  port: parseInt(url.port || '6379'),
};

if (url.password) connection.password = url.password;
if (url.username) connection.username = url.username;
if (url.protocol === 'rediss:') connection.tls = {};

/**
 * Generate landing page content using OpenAI
 * @param {object} jobData - Job data
 * @returns {Promise<object>} - Generated content
 */
async function generateLanding(jobData) {
  const { brief = '', page_type = 'invest' } = jobData;

  // Build prompt for OpenAI
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

  // Call OpenAI API
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
  const text = j?.choices?.[0]?.message?.content || j?.choices?.[0]?.text || '';

  // Parse JSON response
  let out = null;
  try {
    out = JSON.parse(text);
  } catch (e) {
    const m = text.match(/\{[\s\S]*\}$/);
    if (m) {
      try {
        out = JSON.parse(m[0]);
      } catch (e2) {
        throw new Error('LLM returned non-JSON: ' + text);
      }
    } else {
      throw new Error('LLM returned non-JSON: ' + text);
    }
  }

  return out;
}

/**
 * Generate HTML from landing data
 * @param {object} data - Landing data
 * @returns {string} - HTML content
 */
function generateHTML(data) {
  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(
    (data.seo && data.seo.title) || 'Landing'
  )}</title><meta name="description" content="${escapeHtml(
    (data.seo && data.seo.description) || ''
  )}"></head><body>
  <section style="padding:28px;background:#fff;">
    <h1>${escapeHtml(data.hero?.title || '')}</h1>
    <p>${escapeHtml(data.hero?.subtitle || '')}</p>
    ${
      data.hero?.cta
        ? `<p><a href="#" style="display:inline-block;padding:10px 14px;background:#ffb400;color:#111;border-radius:10px;text-decoration:none">${escapeHtml(
            data.hero.cta
          )}</a></p>`
        : ''
    }
  </section>
  ${
    Array.isArray(data.benefits)
      ? '<section><h2>Преимущества</h2><div>' +
        data.benefits
          .map(
            (b) =>
              `<div><strong>${escapeHtml(b.title)}</strong><p>${escapeHtml(b.text)}</p></div>`
          )
          .join('') +
        '</div></section>'
      : ''
  }
  ${
    Array.isArray(data.faq)
      ? '<section><h2>FAQ</h2>' +
        data.faq
          .map(
            (q) =>
              `<details><summary>${escapeHtml(q.q)}</summary><div>${escapeHtml(q.a)}</div></details>`
          )
          .join('') +
        '</section>'
      : ''
  }
  </body></html>`;
}

// Create worker
const worker = new Worker(
  'landing-generation',
  async (job) => {
    const { sessionId, brief, page_type } = job.data;

    console.log(`[Worker] Processing job for session: ${sessionId}`);

    try {
      // Update session status to 'processing'
      await updateSession(sessionId, 'processing', { brief, page_type });

      // Generate landing page content
      const landingData = await generateLanding({ brief, page_type });

      // Generate HTML
      const html = generateHTML(landingData);

      // Upload to S3 (if configured)
      let s3Urls = {};
      let s3UploadFailed = false;
      if (process.env.S3_BUCKET) {
        try {
          const jsonKey = `landings/${sessionId}/landing.json`;
          const htmlKey = `landings/${sessionId}/landing.html`;

          const [jsonUrl, htmlUrl] = await Promise.all([
            uploadJSON(jsonKey, landingData),
            uploadHTML(htmlKey, html),
          ]);

          s3Urls = { jsonUrl, htmlUrl };
          console.log(`[Worker] Uploaded to S3: ${sessionId}`);
        } catch (err) {
          console.error(`[Worker] S3 upload failed: ${err.message}`);
          s3UploadFailed = true;
          // Store error but continue - data is still available in database
          s3Urls = { error: err.message };
        }
      }

      // Update session with result
      const result = {
        brief,
        page_type,
        data: landingData,
        s3: s3Urls,
        s3UploadFailed,
        completedAt: new Date().toISOString(),
      };

      await updateSession(sessionId, 'completed', result);

      console.log(`[Worker] Job completed for session: ${sessionId}${s3UploadFailed ? ' (S3 upload failed)' : ''}`);
      return result;
    } catch (err) {
      console.error(`[Worker] Job failed for session ${sessionId}:`, err);

      // Update session with error
      await updateSession(sessionId, 'failed', {
        error: err.message,
        failedAt: new Date().toISOString(),
      });

      throw err;
    }
  },
  {
    connection,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '2'),
  }
);

worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err);
});

worker.on('error', (err) => {
  console.error('[Worker] Worker error:', err);
});

console.log('[Worker] Landing generation worker started');
console.log(`[Worker] Concurrency: ${process.env.WORKER_CONCURRENCY || '2'}`);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Worker] SIGTERM received, shutting down gracefully...');
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Worker] SIGINT received, shutting down gracefully...');
  await worker.close();
  process.exit(0);
});
