// worker/worker.js - Background worker for processing landing page generation jobs
// Uses BullMQ to process jobs from Redis queue, calls OpenAI, and saves results to S3 and PostgreSQL

import { Worker } from 'bullmq';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { initDB, updateSession } from '../server/db.js';
import { initS3, uploadJSON, uploadHTML } from '../server/s3.js';

dotenv.config();

// Initialize connections
initDB();
initS3();

const OPENAI_KEY = process.env.OPENAI_KEY;
const REDIS_URL = process.env.REDIS_URL;

if (!OPENAI_KEY) {
  console.error('ERROR: OPENAI_KEY not set in environment');
  process.exit(1);
}

if (!REDIS_URL) {
  console.error('ERROR: REDIS_URL not set in environment');
  process.exit(1);
}

/**
 * Parse Redis URL into connection configuration
 * @param {string} url - Redis connection URL
 * @returns {Object} Redis connection config
 */
function parseRedisUrl(url) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port) || 6379,
      password: parsed.password || undefined,
      username: parsed.username || undefined,
      tls: parsed.protocol === 'rediss:' ? {} : undefined,
    };
  } catch (error) {
    console.error('Failed to parse Redis URL:', error);
    throw error;
  }
}

/**
 * Generate landing page content using OpenAI
 * @param {string} brief - User brief
 * @param {string} pageType - Page type
 * @returns {Promise<Object>} Generated JSON structure
 */
async function generateWithOpenAI(brief, pageType) {
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

  if (!resp.ok) {
    throw new Error(`OpenAI API error: ${resp.status} ${resp.statusText}`);
  }

  const j = await resp.json();
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
    throw new Error('LLM returned non-JSON response');
  }

  return out;
}

/**
 * Generate HTML from JSON data
 * @param {Object} data - Generated JSON structure
 * @returns {string} HTML content
 */
function generateHTML(data) {
  const escapeHtml = (s) => String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  
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

/**
 * Process landing page generation job
 * @param {Object} job - BullMQ job object
 */
async function processJob(job) {
  const { sessionId, brief, pageType } = job.data;
  
  console.log(`Processing job ${job.id}: ${sessionId}`);
  
  try {
    // Update status to processing
    await updateSession(sessionId, 'processing');
    await job.updateProgress(10);

    // Generate content with OpenAI
    console.log(`Calling OpenAI for session ${sessionId}`);
    const jsonData = await generateWithOpenAI(brief, pageType);
    await job.updateProgress(50);

    // Generate HTML
    const htmlContent = generateHTML(jsonData);
    await job.updateProgress(60);

    // Upload to S3
    console.log(`Uploading artifacts to S3 for session ${sessionId}`);
    const [jsonUrl, htmlUrl] = await Promise.all([
      uploadJSON(sessionId, jsonData),
      uploadHTML(sessionId, htmlContent),
    ]);
    await job.updateProgress(80);

    // Update database with results
    await updateSession(sessionId, 'completed', {
      payload_json: jsonData,
      s3_json_url: jsonUrl,
      s3_html_url: htmlUrl,
    });
    await job.updateProgress(100);

    console.log(`Job completed successfully: ${sessionId}`);
    
    return {
      sessionId,
      status: 'completed',
      jsonUrl,
      htmlUrl,
    };
  } catch (error) {
    console.error(`Job failed for session ${sessionId}:`, error);
    
    // Update database with error
    await updateSession(sessionId, 'failed', {
      error_message: error.message,
    });
    
    throw error; // Re-throw to mark job as failed in queue
  }
}

// Initialize worker
const redisConfig = parseRedisUrl(REDIS_URL);

const worker = new Worker('landing-generation', processJob, {
  connection: redisConfig,
  concurrency: 2, // Process up to 2 jobs concurrently
  limiter: {
    max: 10, // Max 10 jobs per minute
    duration: 60000,
  },
});

// Worker event handlers
worker.on('completed', (job, result) => {
  console.log(`✓ Job ${job.id} completed:`, result);
});

worker.on('failed', (job, err) => {
  console.error(`✗ Job ${job?.id} failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('Worker error:', err);
});

worker.on('ready', () => {
  console.log('Worker is ready and waiting for jobs...');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await worker.close();
  process.exit(0);
});

console.log('Worker started. Listening for jobs on queue: landing-generation');

// TODO: Add more worker features:
// - Job progress reporting
// - Job timeout handling
// - Job retry logic
// - Metrics collection
// - Health monitoring
