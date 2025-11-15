// worker/worker.js — BullMQ worker for processing landing generation jobs
// Reads jobs from Redis queue, calls OpenAI, uploads to S3, and updates database

import 'dotenv/config';
import { Worker } from 'bullmq';
import fetch from 'node-fetch';
import { createConnection } from '../server/redis-connection.js';
import { updateSession } from '../server/db.js';
import { uploadHTML, uploadJSON, getPresignedUrl, getSessionKey } from '../server/s3.js';

const OPENAI_KEY = process.env.OPENAI_KEY || process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

if (!OPENAI_KEY) {
  console.error('ERROR: OPENAI_KEY or OPENAI_API_KEY not set');
  process.exit(1);
}

/**
 * Process generation job
 * @param {Object} job - BullMQ job object
 */
async function processGenerationJob(job) {
  const { sessionId, brief, page_type = 'invest' } = job.data;
  
  console.log(`[Worker] Processing job ${job.id} for session ${sessionId}`);
  
  try {
    // Update session status to processing
    await updateSession(sessionId, { status: 'processing' });
    await job.updateProgress(10);

    // Build OpenAI prompt
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
    console.log(`[Worker] Calling OpenAI for session ${sessionId}`);
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: "You output only JSON object, no extra commentary." },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.6,
        max_tokens: 900,
      }),
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      throw new Error(`OpenAI API error: ${resp.status} - ${errorText}`);
    }

    const j = await resp.json();
    const text = j?.choices?.[0]?.message?.content || j?.choices?.[0]?.text || "";
    
    await job.updateProgress(40);

    // Parse JSON response
    let landingData = null;
    try { 
      landingData = JSON.parse(text); 
    } catch (e) {
      const m = text.match(/\{[\s\S]*\}$/);
      if (m) {
        try { 
          landingData = JSON.parse(m[0]); 
        } catch (e2) { 
          throw new Error('LLM returned non-JSON'); 
        }
      } else {
        throw new Error('LLM returned non-JSON');
      }
    }

    if (!landingData) {
      throw new Error('Failed to parse landing data from OpenAI response');
    }

    await job.updateProgress(60);

    // Generate HTML
    const html = generateHTML(landingData);
    
    // Upload to S3
    console.log(`[Worker] Uploading results to S3 for session ${sessionId}`);
    const htmlKey = getSessionKey(sessionId, 'landing.html');
    const jsonKey = getSessionKey(sessionId, 'landing.json');
    
    await uploadHTML(htmlKey, html);
    await uploadJSON(jsonKey, landingData);
    
    await job.updateProgress(80);

    // Generate presigned URLs (valid for 7 days)
    const htmlUrl = await getPresignedUrl(htmlKey, 7 * 24 * 3600);
    const jsonUrl = await getPresignedUrl(jsonKey, 7 * 24 * 3600);

    // Update session with results
    await updateSession(sessionId, {
      status: 'completed',
      result_url: JSON.stringify({ html: htmlUrl, json: jsonUrl }),
    });

    await job.updateProgress(100);

    console.log(`[Worker] Job ${job.id} completed for session ${sessionId}`);
    
    return { 
      success: true, 
      sessionId, 
      urls: { html: htmlUrl, json: jsonUrl } 
    };

  } catch (error) {
    console.error(`[Worker] Job ${job.id} failed:`, error);
    
    // Update session with error
    await updateSession(sessionId, {
      status: 'failed',
      error_message: error.message,
    });

    throw error;
  }
}

/**
 * Generate HTML from landing data
 */
function generateHTML(data) {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml((data.seo && data.seo.title) || "Landing")}</title><meta name="description" content="${escapeHtml((data.seo && data.seo.description) || "")}"></head><body>
  <section style="padding:28px;background:#fff;">
    <h1>${escapeHtml(data.hero?.title || "")}</h1>
    <p>${escapeHtml(data.hero?.subtitle || "")}</p>
    ${data.hero?.cta ? `<p><a href="#" style="display:inline-block;padding:10px 14px;background:#ffb400;color:#111;border-radius:10px;text-decoration:none">${escapeHtml(data.hero.cta)}</a></p>` : ""}
  </section>
  ${(Array.isArray(data.benefits) ? '<section><h2>Преимущества</h2><div>' + data.benefits.map(b=>`<div><strong>${escapeHtml(b.title)}</strong><p>${escapeHtml(b.text)}</p></div>`).join('') + '</div></section>' : '')}
  ${(Array.isArray(data.faq) ? '<section><h2>FAQ</h2>' + data.faq.map(q=>`<details><summary>${escapeHtml(q.q)}</summary><div>${escapeHtml(q.a)}</div></details>`).join('') + '</section>' : '')}
  </body></html>`;
}

function escapeHtml(s) { 
  return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); 
}

// Initialize worker
const connection = createConnection();

const worker = new Worker(
  'landing-generation',
  processGenerationJob,
  {
    connection,
    concurrency: 5, // Process up to 5 jobs concurrently
    limiter: {
      max: 10, // Max 10 jobs
      duration: 60000, // per 60 seconds
    },
  }
);

// Worker event handlers
worker.on('completed', (job, _result) => {
  console.log(`[Worker] Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job.id} failed with error:`, err.message);
});

worker.on('error', (err) => {
  console.error('[Worker] Worker error:', err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Worker] SIGTERM received, closing worker...');
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Worker] SIGINT received, closing worker...');
  await worker.close();
  process.exit(0);
});

console.log('[Worker] Landing generation worker started');
console.log(`[Worker] OpenAI Model: ${OPENAI_MODEL}`);

// TODO: Add support for batch processing
// TODO: Add worker metrics and monitoring
// TODO: Add custom retry strategies based on error type
// TODO: Add support for job prioritization
// TODO: Add notification system for completed/failed jobs
