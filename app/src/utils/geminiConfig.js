/**
 * Shared Gemini model config for both bill scan (OCR) and voice parse.
 * Using the same model keeps quotas and behavior consistent.
 */
export const GEMINI_MODEL = 'gemini-2.5-flash';
export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
export const GEMINI_API_URL = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent`;
