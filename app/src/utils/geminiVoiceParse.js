/**
 * Parse voice/preview text with Gemini to extract expense structure as JSON.
 * Used from VoiceInputScreen when user taps Continue.
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

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
- payer.name: who paid the full amount (e.g. "John", "Alice", "I paid" -> use "Me" or the speaker identifier).
- Extract names as stated; they may be first names, nicknames, or "me"/"I".
- Return ONLY the JSON object. No \`\`\`json or markdown.`;

/**
 * Call Gemini API with text only (no image).
 * @param {string} previewText - The voice/preview text to parse
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<{ payer: { name: string }, totalAmount: number, splitMembers: Array<{ name: string, amount: number }> }>}
 */
export async function parseVoiceWithGemini(previewText, apiKey) {
  if (!previewText || !previewText.trim()) {
    throw new Error('Preview text is empty');
  }
  if (!apiKey || !apiKey.trim()) {
    throw new Error('API key is missing');
  }

  const requestBody = {
    contents: [
      {
        parts: [{ text: `${VOICE_PARSE_PROMPT}\n\n---\n\nInput text:\n${previewText.trim()}` }],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 2048,
    },
  };

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const msg = errBody?.error?.message || `API Error: ${response.status}`;
    throw new Error(msg);
  }

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
