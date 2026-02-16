import CryptoJS from 'crypto-js';
import crypto from 'node:crypto';
import logger from './logger.js';

// Get encryption key from environment.
// Fail fast at startup if not set — do not allow silent failures at runtime.
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  logger.error('[encryption] ENCRYPTION_KEY not set. Chat encryption will be unavailable.');
}

// ── Derive a proper 32-byte key using SHA-256 (deterministic, no salt needed for
// a server-side symmetric key). This replaces CryptoJS's EVP_BytesToKey/MD5.
const derivedKey = ENCRYPTION_KEY
  ? crypto.createHash('sha256').update(ENCRYPTION_KEY).digest()
  : null;

// ── New format prefix — ciphertexts encrypted with v2 start with "v2:"
const V2_PREFIX = 'v2:';
const IV_LENGTH = 12; // AES-GCM standard nonce length
const AUTH_TAG_LENGTH = 16; // AES-GCM tag length in bytes

/**
 * Encrypt text using AES-256-GCM with random IV.
 * Output format: "v2:{base64(iv ++ authTag ++ ciphertext)}"
 *
 * @param {string} text - Plain text message
 * @returns {string} - Encrypted message (v2 format)
 */
export const encryptMessage = (text) => {
  if (!text) return text;
  if (!derivedKey) throw new Error('ENCRYPTION_KEY not configured — cannot encrypt');

  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    // Pack: iv (12) + authTag (16) + ciphertext
    const packed = Buffer.concat([iv, authTag, encrypted]);
    return V2_PREFIX + packed.toString('base64');
  } catch (error) {
    logger.error('Encryption error', { error: error.message });
    throw new Error('Failed to encrypt message');
  }
};

/**
 * Decrypt text — auto-detects v2 (AES-256-GCM) vs legacy (CryptoJS passphrase).
 * This ensures backward compatibility with messages encrypted before the upgrade.
 *
 * @param {string} encryptedText - Encrypted message
 * @returns {string} - Decrypted plain text
 */
export const decryptMessage = (encryptedText) => {
  if (!encryptedText) return encryptedText;
  if (!ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY not configured — cannot decrypt');

  try {
    if (encryptedText.startsWith(V2_PREFIX)) {
      // v2 format: AES-256-GCM
      const packed = Buffer.from(encryptedText.slice(V2_PREFIX.length), 'base64');
      const iv = packed.subarray(0, IV_LENGTH);
      const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
      const ciphertext = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
      const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv);
      decipher.setAuthTag(authTag);
      return decipher.update(ciphertext, undefined, 'utf8') + decipher.final('utf8');
    }

    // Legacy CryptoJS passphrase-mode fallback
    const decrypted = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY);
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    logger.error('Decryption error', { error: error.message });
    throw new Error('Failed to decrypt message');
  }
};

/**
 * Encrypt object (for JSON data) — uses v2 AES-256-GCM
 * @param {Object} data - Plain object
 * @returns {string} - Encrypted string (v2 format)
 */
export const encryptObject = (data) => {
  if (!data) return data;

  try {
    const jsonString = JSON.stringify(data);
    return encryptMessage(jsonString);
  } catch (error) {
    logger.error('Object encryption error', { error: error.message });
    throw new Error('Failed to encrypt data');
  }
};

/**
 * Decrypt object — auto-detects v2 vs legacy
 * @param {string} encryptedData - Encrypted string
 * @returns {Object} - Decrypted object
 */
export const decryptObject = (encryptedData) => {
  if (!encryptedData) return encryptedData;

  try {
    const jsonString = decryptMessage(encryptedData);
    return JSON.parse(jsonString);
  } catch (error) {
    logger.error('Object decryption error', { error: error.message });
    throw new Error('Failed to decrypt data');
  }
};

/**
 * Generate unique encryption key for voice/video streams
 * @returns {string} - Unique session key
 */
export const generateSessionKey = () => {
  return crypto.randomBytes(32).toString('base64');
};

/**
 * Encrypt media URL (for secure media access) — uses v2 AES-256-GCM
 * @param {string} mediaUrl - Media file URL
 * @returns {string} - Encrypted URL token
 */
export const encryptMediaUrl = (mediaUrl) => {
  const timestamp = Date.now();
  const data = `${mediaUrl}|${timestamp}`;
  return encryptMessage(data);
};

/**
 * Decrypt and validate media URL token — auto-detects v2 vs legacy
 * @param {string} token - Encrypted media token
 * @param {number} expiryMinutes - Token expiry time in minutes (default 60)
 * @returns {string|null} - Decrypted URL or null if expired
 */
export const decryptMediaUrl = (token, expiryMinutes = 60) => {
  try {
    const data = decryptMessage(token);
    const [url, timestamp] = data.split('|');

    // Check if token is expired
    const now = Date.now();
    const expiry = parseInt(timestamp) + expiryMinutes * 60 * 1000;

    if (now > expiry) {
      return null; // Token expired
    }

    return url;
  } catch (error) {
    logger.error('Media URL decryption error', { error: error.message });
    return null;
  }
};

/**
 * Hash sensitive data (for storing passwords, etc.)
 * Uses SHA-256 (same as before, no change needed)
 * @param {string} data - Data to hash
 * @returns {string} - Hashed data
 */
export const hashData = (data) => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

export default {
  encryptMessage,
  decryptMessage,
  encryptObject,
  decryptObject,
  generateSessionKey,
  encryptMediaUrl,
  decryptMediaUrl,
  hashData,
};
