// server/generate.js — Landing page generation logic with async support
import OpenAI from 'openai';
import { createSession, updateSession, getSession } from './db.js';
import { addGenerationJob } from './queue.js';
import { randomBytes } from 'crypto';

// TODO: Add prompt template management
// TODO: Add generation parameter validation
// TODO: Add cost tracking and limits
// TODO: Add content moderation
// TODO: Add A/B testing support

const OPENAI_KEY = process.env.OPENAI_KEY || process.env.OPENAI_API_KEY;

if (!OPENAI_KEY) {
  console.warn('WARNING: OPENAI_KEY/OPENAI_API_KEY not set.');
}

const openai = OPENAI_KEY ? new OpenAI({ apiKey: OPENAI_KEY }) : null;

/**
 * Generate session ID
 * @returns {string} Unique session identifier
 */
function generateSessionId() {
  return `session-${Date.now()}-${randomBytes(8).toString('hex')}`;
}

/**
 * Generate landing page (sync mode)
 * @param {object} params - Generation parameters
 * @returns {Promise<object>} Generated content
 */
export async function generateLandingSync(params) {
  const { brief = '', page_type = 'invest', model = 'gpt-3.5-turbo' } = params;

  if (!openai) {
    throw new Error('OpenAI client not initialized. Check OPENAI_KEY configuration.');
  }

  if (!brief) {
    throw new Error('Brief is required for landing page generation.');
  }

  // Build prompt for landing page generation
  const systemPrompt = `You are a professional landing page generator. 
Generate a complete, modern, responsive HTML landing page based on the provided brief.
The page should be visually appealing, have clear call-to-action, and be optimized for conversion.
Return ONLY the complete HTML code, no explanations.`;

  const userPrompt = `Create a ${page_type} landing page with the following brief:\n\n${brief}`;

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const htmlContent = response.choices[0]?.message?.content || '';

    return {
      html: htmlContent,
      model: response.model,
      usage: response.usage,
    };
  } catch (error) {
    console.error('OpenAI generation failed:', error);
    throw new Error(`Generation failed: ${error.message}`);
  }
}

/**
 * Generate landing page (async mode - queues job)
 * @param {object} params - Generation parameters
 * @returns {Promise<object>} Session info with queued status
 */
export async function generateLandingAsync(params) {
  const sessionId = generateSessionId();

  // Create session in database
  await createSession(sessionId, params);

  // Add job to queue
  await addGenerationJob(sessionId, params);

  return {
    sessionId,
    status: 'queued',
    message: 'Landing page generation has been queued. Check status with GET /api/status/:sessionId',
  };
}

/**
 * Get generation status
 * @param {string} sessionId - Session identifier
 * @returns {Promise<object>} Session status
 */
export async function getGenerationStatus(sessionId) {
  const session = await getSession(sessionId);

  if (!session) {
    return null;
  }

  return {
    sessionId: session.session_id,
    status: session.status,
    artifactUrl: session.artifact_url,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
  };
}

/**
 * Main generate function that handles both sync and async modes
 * @param {object} params - Generation parameters
 * @param {boolean} async - Whether to use async mode
 * @returns {Promise<object>} Generation result
 */
export async function generate(params, async = false) {
  if (async) {
    return await generateLandingAsync(params);
  } else {
    return await generateLandingSync(params);
  }
}
