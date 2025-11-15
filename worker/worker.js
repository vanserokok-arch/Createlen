// worker/worker.js - BullMQ worker for async landing generation
import 'dotenv/config';
import { Worker } from 'bullmq';
import fetch from 'node-fetch';
import { getRedisConnection } from '../server/queue.js';
import { updateSession } from '../server/db.js';
import { uploadLandingArtifacts, getArtifactUrls } from '../server/s3.js';

const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;

/**
 * Generate landing page using OpenAI API
 * This reuses the same logic from server.js /generate endpoint
 */
async function generateLanding(brief, pageType = 'invest') {
  if (!OPENAI_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const userPrompt = `
You are a JSON generator for a Russian law firm's landing page.
Input brief: ${brief}
page_type: ${pageType}
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

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You output only JSON object, no extra commentary." },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.6,
      max_tokens: 900,
    }),
  });

  const j = await resp.json().catch(() => null);
  const text = j?.choices?.[0]?.message?.content || j?.choices?.[0]?.text || "";

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
    throw new Error('LLM returned non-JSON: ' + text.substring(0, 200));
  }

  return out;
}

/**
 * Generate HTML from landing data
 * Reuses logic from server.js /export endpoint
 */
function generateHTML(data) {
  const escapeHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml((data.seo && data.seo.title) || "Landing")}</title><meta name="description" content="${escapeHtml((data.seo && data.seo.description) || "")}"></head><body>
  <section style="padding:28px;background:#fff;">
    <h1>${escapeHtml(data.hero?.title || "")}</h1>
    <p>${escapeHtml(data.hero?.subtitle || "")}</p>
    ${data.hero?.cta ? `<p><a href="#" style="display:inline-block;padding:10px 14px;background:#ffb400;color:#111;border-radius:10px;text-decoration:none">${escapeHtml(data.hero.cta)}</a></p>` : ""}
  </section>
  ${(Array.isArray(data.benefits) ? '<section><h2>Преимущества</h2><div>' + data.benefits.map(b => `<div><strong>${escapeHtml(b.title)}</strong><p>${escapeHtml(b.text)}</p></div>`).join('') + '</div></section>' : '')}
  ${(Array.isArray(data.faq) ? '<section><h2>FAQ</h2>' + data.faq.map(q => `<details><summary>${escapeHtml(q.q)}</summary><div>${escapeHtml(q.a)}</div></details>`).join('') + '</section>' : '')}
  </body></html>`;
}

/**
 * Process landing generation job
 */
async function processJob(job) {
  const { sessionId, brief, page_type } = job.data;

  console.log(`[Worker] Processing job ${sessionId}...`);

  try {
    // Update status to processing
    await updateSession(sessionId, 'processing');
    await job.updateProgress(25);

    // Generate landing data
    const data = await generateLanding(brief, page_type);
    await job.updateProgress(50);

    // Generate HTML
    const html = generateHTML(data);
    await job.updateProgress(75);

    // Upload to S3
    const s3Keys = await uploadLandingArtifacts(sessionId, data, html);
    await job.updateProgress(90);

    // Get presigned URLs
    const urls = await getArtifactUrls(s3Keys);

    // Update session with result
    await updateSession(sessionId, 'completed', {
      result: {
        data,
        s3Keys,
        urls,
      },
    });

    await job.updateProgress(100);

    console.log(`[Worker] Job ${sessionId} completed successfully`);

    return {
      sessionId,
      status: 'completed',
      urls,
    };
  } catch (error) {
    console.error(`[Worker] Job ${sessionId} failed:`, error);

    // Update session with error
    await updateSession(sessionId, 'failed', {
      error: error.message,
    });

    throw error;
  }
}

// Create worker
const connection = getRedisConnection();

const worker = new Worker('landing-generation', processJob, {
  connection,
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
  limiter: {
    max: 10,
    duration: 60000, // 10 jobs per minute
  },
});

// Worker event handlers
worker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('Worker error:', err);
});

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

console.log('🚀 Landing generation worker started');
console.log(`   Concurrency: ${worker.opts.concurrency}`);
console.log(`   Listening on queue: landing-generation`);
