const crypto = require('crypto');

/**
 * ============================================================
 * FIELD-LEVEL ENCRYPTION
 * ============================================================
 * Encrypts individual sensitive fields (clinical notes, prescription
 * details, etc.) before they're saved to MongoDB, and decrypts them
 * when read back by legitimate, authenticated app requests.
 *
 * This is a DIFFERENT layer from the database's own disk-level
 * encryption (Percona) — that protects the raw files on disk, but
 * anyone with valid database credentials can still read everything
 * through a normal query. This layer means even a valid DB login
 * only shows scrambled ciphertext for these specific fields, unless
 * they also hold FIELD_ENCRYPTION_KEY — which is deliberately kept
 * OUT of the general project `.env` every developer has, and instead
 * lives only in `backend/.env.encryption` on the VM (chmod 600,
 * held by a small trusted group, never committed to git).
 *
 * Uses AES-256-GCM: authenticated encryption (detects tampering, not
 * just scrambling) via Node's built-in crypto module — no extra
 * dependency needed.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;       // recommended IV size for GCM
const AUTH_TAG_LENGTH = 16;
const PREFIX = 'enc:';      // tags a value as encrypted, vs. legacy plain text

function getKey() {
  const keyHex = process.env.FIELD_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error(
      'FIELD_ENCRYPTION_KEY is not set. Sensitive fields cannot be saved/read ' +
      'without it — see backend/.env.encryption on the VM.'
    );
  }
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('FIELD_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).');
  }
  return key;
}

/**
 * Encrypts a single string field. Returns non-strings / empty values
 * unchanged (nothing to protect), and never double-encrypts a value
 * that's already tagged as encrypted.
 */
function encryptField(plaintext) {
  if (plaintext === null || plaintext === undefined || plaintext === '') return plaintext;
  const text = String(plaintext);
  if (text.startsWith(PREFIX)) return text; // already encrypted, leave as-is

  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return PREFIX + Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

/**
 * Decrypts a single field. Values without the "enc:" prefix are
 * assumed to be legacy plain-text (saved before this was added) and
 * are returned unchanged — so old data keeps working without a
 * separate migration step.
 */
function decryptField(value) {
  if (typeof value !== 'string' || !value.startsWith(PREFIX)) return value;

  const key = getKey();
  const raw = Buffer.from(value.slice(PREFIX.length), 'base64');
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  return decrypted.toString('utf8');
}

module.exports = { encryptField, decryptField };
