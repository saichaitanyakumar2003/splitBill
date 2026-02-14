/**
 * Encrypt password with RSA public key (RSA-OAEP, SHA-256).
 * Optional: npm install node-forge. If not installed, returns null and caller sends plain.
 */

/**
 * Encrypt plain text with the given public key PEM. Returns base64 string or null.
 * @param {string} publicKeyPem - PEM string (-----BEGIN PUBLIC KEY----- ...)
 * @param {string} plainText
 * @returns {string|null} - Base64-encoded ciphertext, or null if encryption fails / node-forge not installed
 */
export function encryptWithPublicKey(publicKeyPem, plainText) {
  if (!publicKeyPem || typeof plainText !== 'string') return null;
  let forge;
  try {
    forge = require('node-forge');
  } catch (_) {
    return null;
  }
  try {
    const key = forge.pki.publicKeyFromPem(publicKeyPem);
    const encrypted = key.encrypt(plainText, 'RSA-OAEP', {
      md: forge.md.sha256.create(),
      mgf1: { md: forge.md.sha256.create() },
    });
    return forge.util.encode64(encrypted);
  } catch (e) {
    return null;
  }
}
