// server.js — минимальный сервер для Replit
// Устанавливаем зависимости: express node-fetch archiver dotenv
// Secrets in Replit: OPENAI_KEY, ALLOWED_TOKEN
import express from "express";
import fetch from "node-fetch";
import archiver from "archiver";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json({ limit: "200kb" }));

const OPENAI_KEY = process.env.OPENAI_KEY;
const ALLOWED_TOKEN = process.env.ALLOWED_TOKEN || "";
if (!OPENAI_KEY) console.warn("WARNING: OPENAI_KEY not set in env/replit secrets.");

const inMemoryStore = {}; // { sessionId: { data: JSON } }

// Helper: validate token (simple)
function checkToken(req) {
  // token can be provided in body or query (for export)
  const t = (req.body && req.body.token) || req.query.token || "";
  return !ALLOWED_TOKEN || t === ALLOWED_TOKEN;
}

// POST /generate -> calls OpenAI and stores result in memory
app.post("/generate", async (req, res) => {
  try {
    if (!checkToken(req)) return res.status(401).json({ error: "Unauthorized: invalid token" });
    const { brief = "", page_type = "invest", sessionId = "session-1" } = req.body;
    if (!brief) return res.status(400).json({ error: "Empty brief" });

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