import OpenAI from "openai";

export function getClient() {
  const apiKey = process.env.OPENAI_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_KEY or OPENAI_API_KEY not configured');
  return new OpenAI({ apiKey });
}

export async function moderateContent(client, input) {
  // If moderation is not needed, skip in future. Keep optional wrapper.
  try {
    const resp = await client.moderations.create({ model: 'omni-moderation-latest', input });
    const results = resp.results?.[0];
    return results;
  } catch (err) {
    // In case moderation fails, return null and let caller decide
    return null;
  }
}

export async function generateFromPrompt(client, prompt, model = 'gpt-4o-mini') {
  const resp = await client.responses.create({ model, input: prompt, max_tokens: 800 });
  // Try to extract text
  const text = resp.output?.[0]?.content?.[0]?.text ?? JSON.stringify(resp);
  return text;
}
