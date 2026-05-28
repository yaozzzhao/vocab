import { Env } from './_helpers';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

async function geminiFetch(env: Env, parts: unknown[]): Promise<string> {
  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  const model = env.GEMINI_MODEL || 'gemini-2.0-flash';
  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${env.GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1200 },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API request failed (${response.status}): ${errText}`);
  }

  const data = await response.json() as any;
  const parts_text = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts_text.map((part: { text?: string }) => part.text ?? '').join('').trim();
  if (!text) throw new Error('Gemini API returned an empty response.');
  return text;
}

export async function callGeminiGenerateContent(env: Env, prompt: string): Promise<string> {
  return geminiFetch(env, [{ text: prompt }]);
}

export async function callGeminiVision(env: Env, prompt: string, imageBase64: string, mimeType: string): Promise<string> {
  return geminiFetch(env, [
    { text: prompt },
    { inlineData: { mimeType, data: imageBase64 } },
  ]);
}
