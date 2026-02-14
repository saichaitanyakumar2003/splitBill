/**
 * All password hashing for signup/login happens on the client. We never send the plain password.
 * We send SHA-256(password) as hex. The backend does not decrypt; it only bcrypts this value
 * for storage and compares on login. DB stores bcrypt(clientHash) only.
 */
import * as Crypto from 'expo-crypto';

const ALGORITHM = Crypto.CryptoDigestAlgorithm.SHA256;
const ENCODING = Crypto.CryptoEncoding.HEX;

/**
 * Hash a plain password with SHA-256 (hex). Use this before sending password to the API.
 * @param {string} plainPassword - The user-entered password
 * @returns {Promise<string>} - Hex-encoded SHA-256 hash (64 chars)
 */
export async function hashPasswordAsync(plainPassword) {
  if (typeof plainPassword !== 'string') return '';
  const digest = await Crypto.digestStringAsync(ALGORITHM, plainPassword, { encoding: ENCODING });
  return digest;
}
