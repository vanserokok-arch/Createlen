// server/generate.js — OpenAI integration for content generation
// TODO: Add response caching to reduce API costs
// TODO: Implement streaming responses for real-time feedback
// TODO: Add content moderation checks

import fetch from 'node-fetch';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;

if (!OPENAI_API_KEY) {
  console.warn('WARNING: OPENAI_API_KEY not set. OpenAI calls will fail.');
}

/**
 * Generate landing page content using OpenAI
 * @param {string} brief - User's brief description
 * @param {string} pageType - Type of landing page (e.g., 'invest', 'corporate')
 * @returns {Promise<object>} Generated content structure
 */
export async function generateLandingContent(brief, pageType = 'invest') {
  if (!brief) {
    throw new Error('Brief is required for content generation');
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
`.trim();

  // Call OpenAI Chat Completions API
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini', // Cost-effective model for testing
      messages: [
        { role: 'system', content: 'You output only JSON object, no extra commentary.' },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.6,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || '';

  // Parse JSON from response
  let parsedContent = null;
  try {
    parsedContent = JSON.parse(content);
  } catch (err) {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsedContent = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } catch (err2) {
        throw new Error('Failed to parse JSON from OpenAI response');
      }
    } else {
      throw new Error('No valid JSON found in OpenAI response');
    }
  }

  return parsedContent;
}

/**
 * Convert JSON content to HTML landing page
 * @param {object} content - Structured content from OpenAI
 * @returns {string} HTML document
 */
export function contentToHtml(content) {
  const escapeHtml = (s) => 
    String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(content.seo?.title || 'Landing Page')}</title>
  <meta name="description" content="${escapeHtml(content.seo?.description || '')}">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; line-height: 1.6; }
    section { padding: 40px 20px; max-width: 1200px; margin: 0 auto; }
    h1, h2, h3 { margin-top: 0; }
    .hero { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; }
    .cta-button { display: inline-block; padding: 12px 24px; background: #ffb400; color: #111; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 20px; }
    .benefits, .process, .faq { background: #f8f9fa; }
    .benefit, .step { margin-bottom: 20px; }
    details { margin-bottom: 15px; padding: 15px; background: white; border-radius: 8px; }
    summary { font-weight: bold; cursor: pointer; }
  </style>
</head>
<body>
  <section class="hero">
    <h1>${escapeHtml(content.hero?.title || '')}</h1>
    <p>${escapeHtml(content.hero?.subtitle || '')}</p>
    ${content.hero?.cta ? `<a href="#contact" class="cta-button">${escapeHtml(content.hero.cta)}</a>` : ''}
  </section>
  
  ${Array.isArray(content.benefits) && content.benefits.length > 0 ? `
  <section class="benefits">
    <h2>Преимущества</h2>
    ${content.benefits.map(b => `
      <div class="benefit">
        <h3>${escapeHtml(b.title)}</h3>
        <p>${escapeHtml(b.text)}</p>
      </div>
    `).join('')}
  </section>
  ` : ''}
  
  ${Array.isArray(content.process) && content.process.length > 0 ? `
  <section class="process">
    <h2>Процесс работы</h2>
    ${content.process.map((step, i) => `
      <div class="step">
        <h3>Шаг ${i + 1}: ${escapeHtml(step.step_title)}</h3>
        <p>${escapeHtml(step.step_text)}</p>
      </div>
    `).join('')}
  </section>
  ` : ''}
  
  ${Array.isArray(content.faq) && content.faq.length > 0 ? `
  <section class="faq">
    <h2>Часто задаваемые вопросы</h2>
    ${content.faq.map(q => `
      <details>
        <summary>${escapeHtml(q.q)}</summary>
        <p>${escapeHtml(q.a)}</p>
      </details>
    `).join('')}
  </section>
  ` : ''}
</body>
</html>`;

  return html;
}
