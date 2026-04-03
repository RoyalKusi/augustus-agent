import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  // Read directly from process.env so the key can be set after module load (e.g. in tests)
  const hex = process.env.ENCRYPTION_KEY ?? '';
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes).');
  }
  return Buffer.from(hex, 'hex');
}

export interface EncryptedData {
  iv: string;
  tag: string;
  ciphertext: string;
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns a JSON string containing iv, tag, and ciphertext (all hex-encoded).
 */
export function encrypt(text: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const payload: EncryptedData = {
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    ciphertext: encrypted.toString('hex'),
  };

  return JSON.stringify(payload);
}

/**
 * Decrypts an AES-256-GCM encrypted string produced by `encrypt`.
 * Accepts either a JSON string or a pre-parsed EncryptedData object.
 */
export function decrypt(encryptedData: string | EncryptedData): string {
  const key = getKey();
  const payload: EncryptedData =
    typeof encryptedData === 'string'
      ? (JSON.parse(encryptedData) as EncryptedData)
      : encryptedData;

  const iv = Buffer.from(payload.iv, 'hex');
  const tag = Buffer.from(payload.tag, 'hex');
  const ciphertext = Buffer.from(payload.ciphertext, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}
