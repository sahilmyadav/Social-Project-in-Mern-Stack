import CryptoJS from 'crypto-js';
import logger from './logger.js';

// Get encryption key from environment.
// Fail fast at startup if not set — do not allow silent failures at runtime.
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  logger.error('[encryption] ENCRYPTION_KEY not set. Chat encryption will be unavailable.');
}

/**
 * Encrypt text message
 * @param {string} text - Plain text message
 * @returns {string} - Encrypted message
 */
export const encryptMessage = (text) => {
  if (!text) return text;
  if (!ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY not configured — cannot encrypt');

  try {
    const encrypted = CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
    return encrypted;
  } catch (error) {
    logger.error('Encryption error', { error: error.message });
    throw new Error('Failed to encrypt message');
  }
};

/**
 * Decrypt text message
 * @param {string} encryptedText - Encrypted message
 * @returns {string} - Decrypted plain text
 */
export const decryptMessage = (encryptedText) => {
  if (!encryptedText) return encryptedText;
  if (!ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY not configured — cannot decrypt');

  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY);
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    logger.error('Decryption error', { error: error.message });
    throw new Error('Failed to decrypt message');
  }
};

/**
 * Encrypt object (for JSON data)
 * @param {Object} data - Plain object
 * @returns {string} - Encrypted string
 */
export const encryptObject = (data) => {
  if (!data) return data;

  try {
    const jsonString = JSON.stringify(data);
    return CryptoJS.AES.encrypt(jsonString, ENCRYPTION_KEY).toString();
  } catch (error) {
    logger.error('Object encryption error', { error: error.message });
    throw new Error('Failed to encrypt data');
  }
};

/**
 * Decrypt object
 * @param {string} encryptedData - Encrypted string
 * @returns {Object} - Decrypted object
 */
export const decryptObject = (encryptedData) => {
  if (!encryptedData) return encryptedData;

  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    const jsonString = decrypted.toString(CryptoJS.enc.Utf8);
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
  const randomBytes = CryptoJS.lib.WordArray.random(32);
  return CryptoJS.enc.Base64.stringify(randomBytes);
};

/**
 * Encrypt media URL (for secure media access)
 * @param {string} mediaUrl - Media file URL
 * @returns {string} - Encrypted URL token
 */
export const encryptMediaUrl = (mediaUrl) => {
  const timestamp = Date.now();
  const data = `${mediaUrl}|${timestamp}`;
  return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
};

/**
 * Decrypt and validate media URL token
 * @param {string} token - Encrypted media token
 * @param {number} expiryMinutes - Token expiry time in minutes (default 60)
 * @returns {string|null} - Decrypted URL or null if expired
 */
export const decryptMediaUrl = (token, expiryMinutes = 60) => {
  try {
    const decrypted = CryptoJS.AES.decrypt(token, ENCRYPTION_KEY);
    const data = decrypted.toString(CryptoJS.enc.Utf8);
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
 * @param {string} data - Data to hash
 * @returns {string} - Hashed data
 */
export const hashData = (data) => {
  return CryptoJS.SHA256(data).toString();
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
