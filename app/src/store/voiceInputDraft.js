/**
 * In-memory store for the voice input transcript.
 * Persists when navigating back and returning to the screen; cleared when app process is killed (RAM cleared).
 */
let draft = '';

export function getVoiceInputDraft() {
  return draft;
}

export function setVoiceInputDraft(text) {
  draft = text == null ? '' : String(text);
}

export function clearVoiceInputDraft() {
  draft = '';
}
