/**
 * If RSA_PRIVATE_KEY is not set in env, try to load it from ~/.zshrc.
 * Parses lines like:  export RSA_PRIVATE_KEY="..."  or  RSA_PRIVATE_KEY="..."
 * Runs once at require time so process.env.RSA_PRIVATE_KEY is set before rsa.js is used.
 */

const fs = require('fs');
const path = require('path');

if (process.env.RSA_PRIVATE_KEY) return; // already set (e.g. from .env)

const zshrcPath = path.join(process.env.HOME || process.env.USERPROFILE || '', '.zshrc');
if (!fs.existsSync(zshrcPath)) return;

try {
  const content = fs.readFileSync(zshrcPath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^\s*(?:export\s+)?RSA_PRIVATE_KEY\s*=\s*(["'])(.*)$/);
    if (!match) continue;

    const quote = match[1];
    let value = match[2];

    // If value doesn't contain closing quote, consume following lines (multiline)
    while (value.indexOf(quote) === -1 && i + 1 < lines.length) {
      i++;
      value += '\n' + lines[i];
    }

    const end = value.indexOf(quote);
    if (end === -1) continue;
    value = value.slice(0, end);

    if (quote === '"') {
      value = value.replace(/\\n/g, '\n').replace(/\\"/g, '"');
    }
    value = value.trim();
    if (value) {
      process.env.RSA_PRIVATE_KEY = value;
    }
    break;
  }
} catch (e) {
  // ignore
}
