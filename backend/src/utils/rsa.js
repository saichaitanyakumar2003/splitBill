const crypto = require('crypto');

// Private key PEM: set in .env as RSA_PRIVATE_KEY (or your chosen env name).
const PEM = process.env.RSA_PRIVATE_KEY;

/**
 * Decrypt a password encrypted by the client with the RSA public key.
 * Client uses RSA-OAEP with SHA-256 (same as Node's default for OAEP).
 * @param {string} encryptedBase64 - Base64-encoded ciphertext from client
 * @returns {string|null} - Plain password or null if decryption fails
 */
function decryptPassword(encryptedBase64) {
  if (!PEM || typeof encryptedBase64 !== 'string') return null;
  try {
    const buf = Buffer.from(encryptedBase64, 'base64');
    const plain = crypto.privateDecrypt(
      {
        key: PEM,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      buf
    );
    return plain.toString('utf8');
  } catch (e) {
    return null;
  }
}

/**
 * Use decrypted password if we have RSA key and decryption succeeds; otherwise use raw (backward compat).
 */
function getPlainPassword(rawFromBody) {
  if (!rawFromBody) return null;
  if (PEM) {
    const decrypted = decryptPassword(rawFromBody);
    if (decrypted !== null) return decrypted;
  }
  return rawFromBody;
}

module.exports = { decryptPassword, getPlainPassword };
