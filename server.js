// server.js — минимальный сервер для Replit
// Устанавливаем зависимости: express node-fetch archiver dotenv
// Secrets in Replit: OPENAI_KEY, ALLOWED_TOKEN
import 'dotenv/config';
import express from "express";
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from "node-fetch";
import archiver from "archiver";
import openaiRouter from './src/routes/openai.js';
import healthRouter from './server/health.js';
import { createSession, getSession, initMigrations, isDatabaseConfigured } from './server/db.js';
import { addGenerationJob, isQueueConfigured } from './server/queue.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "1mb" }));

// Static files
app.use(express.static(path.join(__dirname)));

const OPENAI_KEY = process.env.OPENAI_KEY || process.env.OPENAI_API_KEY;
const ALLOWED_TOKEN = process.env.ALLOWED_TOKEN || "";
if (!OPENAI_KEY) console.warn("WARNING: OPENAI_KEY not set in env/replit secrets.");

// Mount health check routes
app.use(healthRouter);

// Mount new OpenAI API routes
app.use('/api', openaiRouter);

const inMemoryStore = {}; // { sessionId: { data: JSON } }

// Initialize database migrations on startup if database is configured
if (isDatabaseConfigured()) {
  initMigrations().catch(err => {
    console.error('Failed to run migrations:', err);
  });
}

// Helper: validate token (simple)
function checkToken(req) {
  // token can be provided in body or query (for export)
  const t = (req.body && req.body.token) || req.query.token || "";
  return !ALLOWED_TOKEN || t === ALLOWED_TOKEN;
}

// POST /generate -> calls OpenAI and stores result in memory or queues async job
app.post("/generate", async (req, res) => {
  try {
    if (!checkToken(req)) return res.status(401).json({ error: "Unauthorized: invalid token" });
    const { brief = "", page_type = "invest", sessionId = "session-1", async = false } = req.body;
    if (!brief) return res.status(400).json({ error: "Empty brief" });

    // Check if async mode is requested and infrastructure is available
    if (async && isQueueConfigured() && isDatabaseConfigured()) {
      // Async mode: queue the job
      try {
        // Create session in database
        await createSession(sessionId, { brief, page_type, async: true });
        
        // Add job to queue
        await addGenerationJob(sessionId, brief, page_type, req.body.token || '');
        
        return res.json({
          sessionId,
          status: 'queued',
          message: 'Job queued for processing',
        });
      } catch (err) {
        console.error('Failed to queue async job:', err);
        // Fallback to sync mode if async fails
        console.log('Falling back to synchronous processing');
      }
    }

    // Synchronous mode (default)
    // Build prompt: instruct to respond with strict JSON
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

    // Call OpenAI Chat Completions
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // replace if needed
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
    try { out = JSON.parse(text); } catch (e) {
      const m = text.match(/\{[\s\S]*\}$/);
      if (m) {
        try { out = JSON.parse(m[0]); } catch (e2) { out = null; }
      }
    }

    if (!out) {
      return res.status(500).json({ error: "LLM returned non-JSON", raw: text });
    }

    // Save to in-memory store
    inMemoryStore[sessionId] = { data: out, createdAt: Date.now() };
    return res.json(out);
  } catch (err) {
    console.error("Generate error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions/:sessionId -> get session status (for async jobs)
app.get("/api/sessions/:sessionId", async (req, res) => {
  if (!checkToken(req)) return res.status(401).json({ error: "Unauthorized" });
  
  const { sessionId } = req.params;
  
  // Check if database is configured
  if (!isDatabaseConfigured()) {
    return res.status(503).json({ error: "Database not configured for async mode" });
  }
  
  try {
    const session = await getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    
    return res.json(session);
  } catch (err) {
    console.error("Failed to get session:", err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /export?sessionId=... -> returns ZIP (landing.html + landing.json)
app.get("/export", async (req, res) => {
  if (!checkToken(req)) return res.status(401).json({ error: "Unauthorized" });
  const sessionId = req.query.sessionId || "session-1";
  const item = inMemoryStore[sessionId];
  if (!item || !item.data) return res.status(404).json({ error: "No generated result for session" });

  const data = item.data;

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="landing-${sessionId}.zip"`);

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.pipe(res);

  // Create minimal landing.html suitable for Tilda HTML-block
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml((data.seo && data.seo.title) || "Landing")}</title><meta name="description" content="${escapeHtml((data.seo && data.seo.description) || "")}"></head><body>
  <section style="padding:28px;background:#fff;">
    <h1>${escapeHtml(data.hero?.title || "")}</h1>
    <p>${escapeHtml(data.hero?.subtitle || "")}</p>
    ${data.hero?.cta ? `<p><a href="#" style="display:inline-block;padding:10px 14px;background:#ffb400;color:#111;border-radius:10px;text-decoration:none">${escapeHtml(data.hero.cta)}</a></p>` : ""}
  </section>
  ${(Array.isArray(data.benefits) ? '<section><h2>Преимущества</h2><div>' + data.benefits.map(b=>`<div><strong>${escapeHtml(b.title)}</strong><p>${escapeHtml(b.text)}</p></div>`).join('') + '</div></section>' : '')}
  ${(Array.isArray(data.faq) ? '<section><h2>FAQ</h2>' + data.faq.map(q=>`<details><summary>${escapeHtml(q.q)}</summary><div>${escapeHtml(q.a)}</div></details>`).join('') + '</section>' : '')}
  </body></html>`;

  archive.append(html, { name: "landing.html" });
  archive.append(JSON.stringify(data, null, 2), { name: "landing.json" });

  archive.finalize();
});

function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));

export default app;
