// worker/worker.js — BullMQ worker for async landing generation
// Processes jobs from Redis queue, calls generation API, saves to S3, updates Postgres

import 'dotenv/config';
import { Worker } from 'bullmq';
import fetch from 'node-fetch';
import archiver from 'archiver';
import { updateSession } from '../server/db.js';
import { generateS3Key, uploadZipToS3, getPresignedDownloadUrl } from '../server/s3.js';

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
  console.error('REDIS_URL is not set. Worker cannot start.');
  process.exit(1);
}

// Parse Redis URL for BullMQ connection
function parseRedisUrl(url) {
  const urlObj = new URL(url);
  return {
    host: urlObj.hostname,
    port: parseInt(urlObj.port) || 6379,
    username: urlObj.username || 'default',
    password: urlObj.password || '',
    tls: urlObj.protocol === 'rediss:' ? {} : undefined,
  };
}

const connection = parseRedisUrl(REDIS_URL);

/**
 * Call the existing /generate endpoint to generate landing data
 * @param {string} brief - User brief/prompt
 * @param {string} pageType - Landing page type
 * @param {string} token - Authentication token
 * @returns {Promise<object>} Generated landing data
 */
async function callGenerateAPI(brief, pageType, token) {
  const apiUrl = process.env.API_URL || 'http://localhost:3000';
  
  try {
    const response = await fetch(`${apiUrl}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        brief,
        page_type: pageType,
        token,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API call failed: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Error calling generate API:', err);
    throw err;
  }
}

/**
 * Create a ZIP archive with landing.html and landing.json
 * @param {object} data - Generated landing data
 * @returns {Promise<Buffer>} ZIP file buffer
 */
async function createZipArchive(data) {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks = [];
    
    archive.on('data', (chunk) => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);
    
    // Helper function to escape HTML
    function escapeHtml(s) {
      return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }
    
    // Create landing.html
    const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml((data.seo && data.seo.title) || 'Landing')}</title><meta name="description" content="${escapeHtml((data.seo && data.seo.description) || '')}"></head><body>
  <section style="padding:28px;background:#fff;">
    <h1>${escapeHtml(data.hero?.title || '')}</h1>
    <p>${escapeHtml(data.hero?.subtitle || '')}</p>
    ${data.hero?.cta ? `<p><a href="#" style="display:inline-block;padding:10px 14px;background:#ffb400;color:#111;border-radius:10px;text-decoration:none">${escapeHtml(data.hero.cta)}</a></p>` : ''}
  </section>
  ${(Array.isArray(data.benefits) ? '<section><h2>Преимущества</h2><div>' + data.benefits.map(b => `<div><strong>${escapeHtml(b.title)}</strong><p>${escapeHtml(b.text)}</p></div>`).join('') + '</div></section>' : '')}
  ${(Array.isArray(data.faq) ? '<section><h2>FAQ</h2>' + data.faq.map(q => `<details><summary>${escapeHtml(q.q)}</summary><div>${escapeHtml(q.a)}</div></details>`).join('') + '</section>' : '')}
  </body></html>`;
    
    archive.append(html, { name: 'landing.html' });
    archive.append(JSON.stringify(data, null, 2), { name: 'landing.json' });
    
    archive.finalize();
  });
}

/**
 * Process a landing generation job
 * @param {object} job - BullMQ job object
 */
async function processGenerationJob(job) {
  const { sessionId, brief, page_type, token } = job.data;
  
  console.log(`[Worker] Processing job ${sessionId}...`);
  
  try {
    // Update session status to 'processing'
    await updateSession(sessionId, { status: 'processing' });
    
    // Step 1: Call the generation API
    job.updateProgress(25);
    console.log(`[Worker] Calling generation API for ${sessionId}...`);
    const landingData = await callGenerateAPI(brief, page_type, token);
    
    // Step 2: Create ZIP archive
    job.updateProgress(50);
    console.log(`[Worker] Creating ZIP archive for ${sessionId}...`);
    const zipBuffer = await createZipArchive(landingData);
    
    // Step 3: Upload to S3
    job.updateProgress(75);
    console.log(`[Worker] Uploading to S3 for ${sessionId}...`);
    const s3Key = generateS3Key(sessionId, 'landing.zip');
    const s3Url = await uploadZipToS3(s3Key, zipBuffer);
    
    // Step 4: Generate presigned URL for download
    const downloadUrl = await getPresignedDownloadUrl(s3Key, 3600 * 24 * 7); // 7 days
    
    // Step 5: Update session with result
    job.updateProgress(100);
    console.log(`[Worker] Updating session ${sessionId} with results...`);
    await updateSession(sessionId, {
      status: 'completed',
      result: landingData,
      s3_url: downloadUrl,
    });
    
    console.log(`[Worker] ✓ Job ${sessionId} completed successfully`);
    
    return {
      success: true,
      sessionId,
      s3Url,
      downloadUrl,
    };
  } catch (err) {
    console.error(`[Worker] ✗ Job ${sessionId} failed:`, err);
    
    // Update session with error
    await updateSession(sessionId, {
      status: 'failed',
      error: err.message,
    });
    
    throw err;
  }
}

// Create and start the worker
const worker = new Worker('landing-generation', processGenerationJob, {
  connection,
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '2'),
  limiter: {
    max: 10,
    duration: 1000,
  },
});

worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err);
});

worker.on('error', (err) => {
  console.error('[Worker] Worker error:', err);
});

console.log('[Worker] Landing generation worker started');
console.log(`[Worker] Concurrency: ${process.env.WORKER_CONCURRENCY || '2'}`);
console.log(`[Worker] Connected to Redis: ${connection.host}:${connection.port}`);

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
