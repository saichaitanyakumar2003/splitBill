/**
 * Parse voice/preview text with Gemini to extract expense structure as JSON.
 * Used from VoiceInputScreen when user taps Continue.
 * Uses same model as bill scan (see geminiConfig.js).
 */

import { GEMINI_API_URL } from './geminiConfig';

const VOICE_PARSE_PROMPT = `You are given a text that describes an expense (from voice or manual input). Extract the following and return ONLY valid JSON, no markdown or explanation.

JSON structure (use exactly these keys):
{
  "payer": { "name": "Full name or identifier of who paid" },
  "totalAmount": number (total amount paid, e.g. 500 or 1200.50),
  "splitMembers": [
    { "name": "Person name or identifier", "amount": number }
  ]
}

Rules:
- totalAmount must be a number (integer or decimal). If currency symbols or commas appear, strip them.
- splitMembers: each person who owes a share and the amount they need to pay. amount must be a number.
- EQUAL SPLIT BY DEFAULT: If the user does NOT explicitly say who pays how much (e.g. no "Alice 200, Bob 300" or "split 500 between them"), treat it as equal split: list all people who are in the split and set amount for each to totalAmount / number of people. Round to 2 decimal places per amount; adjust the last person's amount if needed so the sum equals totalAmount.
- If the text explicitly says "split equally" or "equal split", same as above: equal amounts for each split member.
- If the text explicitly gives per-person amounts (e.g. "John pays 100, Mary 150"), use those amounts.
- payer.name: who paid the full amount. If the text says "me", "I", "I paid", "paid by me" or the speaker paid, set payer.name to the current user name given below. Otherwise use the name as stated (e.g. "John", "Alice").
- Extract other names as stated; they may be first names or nicknames.
- Return ONLY the JSON object. No \`\`\`json or markdown.`;

const RATE_LIMIT_USER_MESSAGE = 'Rate limit reached. Please wait a minute and try again.';

function isRateLimitError(status, message) {
  if (status === 429) return true;
  const m = (message || '').toLowerCase();
  return m.includes('rate limit') || m.includes('resource_exhausted') || m.includes('quota');
}

/**
 * Call Gemini API with text only (no image). Retries on 429 (rate limit) with backoff.
 */
async function callGeminiWithRetry(url, body, apiKey, maxRetries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const waitMs = Math.min(12000 * attempt, 25000); // 12s, then 24s
      await new Promise((r) => setTimeout(r, waitMs));
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (response.ok) return response;
    const errBody = await response.json().catch(() => ({}));
    const msg = errBody?.error?.message || `API Error: ${response.status}`;
    lastError = { status: response.status, message: msg };
    if (response.status === 429 && attempt < maxRetries) continue;
    break;
  }
  if (lastError && isRateLimitError(lastError.status, lastError.message)) {
    throw new Error(RATE_LIMIT_USER_MESSAGE);
  }
  throw new Error(lastError?.message || 'Request failed');
}

/**
 * Call Gemini API with text only (no image).
 * @param {string} previewText - The voice/preview text to parse
 * @param {string} apiKey - Gemini API key
 * @param {string} [userName] - Current user's display name; if payer is "me"/"I", payer.name will be set to this
 * @returns {Promise<{ payer: { name: string }, totalAmount: number, splitMembers: Array<{ name: string, amount: number }> }>}
 */
export async function parseVoiceWithGemini(previewText, apiKey, userName = 'Me') {
  if (!previewText || !previewText.trim()) {
    throw new Error('Preview text is empty');
  }
  if (!apiKey || !apiKey.trim()) {
    throw new Error('API key is missing');
  }

  const userLine = `Current user's name (the speaker): "${String(userName).trim()}". When the payer is me/I or the speaker, set payer.name to exactly this.`;
  const fullPrompt = `${VOICE_PARSE_PROMPT}\n\n${userLine}\n\n---\n\nInput text:\n${previewText.trim()}`;

  const requestBody = {
    contents: [
      {
        parts: [{ text: fullPrompt }],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 2048,
    },
  };

  const response = await callGeminiWithRetry(
    `${GEMINI_API_URL}?key=${apiKey}`,
    requestBody,
    apiKey
  );

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text || !text.trim()) {
    throw new Error('No response from Gemini');
  }

  let jsonStr = text.trim();
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error('Failed to parse voice response');
  }

  if (!parsed.payer || typeof parsed.payer.name !== 'string') {
    throw new Error('Invalid response: missing payer name');
  }
  const totalAmount = typeof parsed.totalAmount === 'number' ? parsed.totalAmount : parseFloat(parsed.totalAmount);
  if (Number.isNaN(totalAmount) || totalAmount <= 0) {
    throw new Error('Invalid response: totalAmount must be a positive number');
  }
  const splitMembers = Array.isArray(parsed.splitMembers)
    ? parsed.splitMembers
        .filter((m) => m && typeof m.name === 'string' && (typeof m.amount === 'number' || !Number.isNaN(parseFloat(m.amount))))
        .map((m) => ({
          name: String(m.name).trim(),
          amount: typeof m.amount === 'number' ? m.amount : parseFloat(m.amount),
        }))
    : [];

  return {
    payer: { name: String(parsed.payer.name).trim() },
    totalAmount,
    splitMembers,
  };
}
