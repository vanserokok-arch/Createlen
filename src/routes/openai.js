import express from 'express';
import { getClient, moderateContent, generateFromPrompt } from '../services/openai.js';

const router = express.Router();

router.post('/generate', async (req, res) => {
  const { prompt, model } = req.body || {};
  if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'Missing prompt' });

  let client;
  try { client = getClient(); } catch (err) { return res.status(500).json({ error: 'OpenAI key not configured' }); }

  // Optional moderation
  try {
    const mod = await moderateContent(client, prompt);
    if (mod && mod.categories && Object.values(mod.categories).some(Boolean)) {
      return res.status(400).json({ error: 'Prompt failed moderation' });
    }
  } catch (e) {
    // ignore moderation failures
  }

  try {
    const text = await generateFromPrompt(client, prompt, model);
    res.json({ text });
  } catch (err) {
    console.error('OpenAI request failed', err);
    res.status(500).json({ error: 'OpenAI request failed' });
  }
});

export default router;
