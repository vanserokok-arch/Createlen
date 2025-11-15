// worker/worker.js — BullMQ worker for processing landing generation tasks
// This worker reads jobs from Redis queue and processes them asynchronously
import 'dotenv/config';
import { Worker } from 'bullmq';
import fetch from 'node-fetch';
import { updateSession } from '../server/db.js';
import { uploadJsonToS3, uploadHtmlToS3, getPresignedUrl } from '../server/s3.js';
import { parseRedisUrl } from '../server/redis-utils.js';

// Get OpenAI API key (support both OPENAI_KEY and OPENAI_API_KEY)
function getOpenAIKey() {
  return process.env.OPENAI_KEY || process.env.OPENAI_API_KEY;
}

// Generate landing content using OpenAI
async function generateLandingContent(brief, pageType = 'invest') {
  const apiKey = getOpenAIKey();
  
  if (!apiKey) {
    throw new Error('OPENAI_KEY or OPENAI_API_KEY not set');
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

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
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

  const json = await resp.json();
  const text = json?.choices?.[0]?.message?.content || json?.choices?.[0]?.text || '';

  // Parse JSON from response
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}$/);
    if (match) {
      try {
        data = JSON.parse(match[0]);
      } catch (e2) {
        throw new Error('Failed to parse JSON from OpenAI response');
      }
    } else {
      throw new Error('No JSON found in OpenAI response');
    }
  }

  return data;
}

// Generate HTML from landing data
function generateHtml(data) {
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

// Worker processor function
async function processJob(job) {
  const { sessionId, brief, page_type } = job.data;
  
  console.log(`Processing job ${job.id} for session ${sessionId}`);
  
  try {
    // Update session status to processing
    await updateSession(sessionId, 'processing');
    
    // Generate content using OpenAI
    job.updateProgress(30);
    const data = await generateLandingContent(brief, page_type);
    
    // Generate HTML
    job.updateProgress(60);
    const html = generateHtml(data);
    
    // Upload to S3
    job.updateProgress(80);
    const jsonKey = `sessions/${sessionId}/landing.json`;
    const htmlKey = `sessions/${sessionId}/landing.html`;
    
    await uploadJsonToS3(jsonKey, data);
    await uploadHtmlToS3(htmlKey, html);
    
    // Get presigned URLs
    const jsonUrl = await getPresignedUrl(jsonKey, 86400); // 24 hours
    const htmlUrl = await getPresignedUrl(htmlKey, 86400);
    
    // Update session with result
    const result = {
      data,
      urls: {
        json: jsonUrl,
        html: htmlUrl,
      },
    };
    
    await updateSession(sessionId, 'completed', result);
    
    job.updateProgress(100);
    console.log(`Job ${job.id} completed successfully`);
    
    return result;
  } catch (error) {
    console.error(`Job ${job.id} failed:`, error);
    
    // Update session status to failed
    await updateSession(sessionId, 'failed', {
      error: error.message,
      stack: error.stack,
    });
    
    throw error;
  }
}

// Create and start the worker
const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  console.error('REDIS_URL environment variable not set');
  process.exit(1);
}

const connection = parseRedisUrl(REDIS_URL);

const worker = new Worker('landing-generation', processJob, {
  connection,
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '2', 10),
  limiter: {
    max: 10,
    duration: 60000, // 10 jobs per minute
  },
});

// Worker event handlers
worker.on('completed', (job) => {
  console.log(`Job ${job.id} has completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} has failed with error:`, err.message);
  if (err.stack) {
    console.error('Stack trace:', err.stack);
  }
});

worker.on('error', (err) => {
  console.error('Worker error:', err);
});

console.log('Worker started, waiting for jobs...');
console.log(`Concurrency: ${worker.opts.concurrency}`);

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
