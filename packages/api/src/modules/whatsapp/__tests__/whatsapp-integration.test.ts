import { describe, it, expect, beforeAll } from 'vitest';
import { encrypt, decrypt } from '../../../utils/crypto.js';

// Set a valid 32-byte hex key for tests
beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'a'.repeat(64); // 64 hex chars = 32 bytes
});

describe('crypto utility', () => {
  it('encrypts and decrypts a plaintext string correctly', () => {
    const plaintext = 'my-secret-access-token';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('produces different ciphertext for the same plaintext (random IV)', () => {
    const plaintext = 'same-token';
    const enc1 = encrypt(plaintext);
    const enc2 = encrypt(plaintext);
    expect(enc1).not.toBe(enc2);
    // But both decrypt to the same value
    expect(decrypt(enc1)).toBe(plaintext);
    expect(decrypt(enc2)).toBe(plaintext);
  });

  it('returns a JSON string with iv, tag, and ciphertext fields', () => {
    const encrypted = encrypt('test');
    const parsed = JSON.parse(encrypted);
    expect(parsed).toHaveProperty('iv');
    expect(parsed).toHaveProperty('tag');
    expect(parsed).toHaveProperty('ciphertext');
  });

  it('accepts a pre-parsed EncryptedData object in decrypt', () => {
    const plaintext = 'token-value';
    const encrypted = encrypt(plaintext);
    const parsed = JSON.parse(encrypted);
    expect(decrypt(parsed)).toBe(plaintext);
  });

  it('throws on tampered ciphertext (auth tag mismatch)', () => {
    const encrypted = encrypt('sensitive');
    const parsed = JSON.parse(encrypted);
    // Flip a byte in the ciphertext
    const tampered = parsed.ciphertext.slice(0, -2) + '00';
    expect(() => decrypt(JSON.stringify({ ...parsed, ciphertext: tampered }))).toThrow();
  });

  it('throws when ENCRYPTION_KEY is missing', () => {
    const saved = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt('x')).toThrow('ENCRYPTION_KEY');
    process.env.ENCRYPTION_KEY = saved;
  });

  it('throws when ENCRYPTION_KEY is wrong length', () => {
    const saved = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = 'tooshort';
    expect(() => encrypt('x')).toThrow('ENCRYPTION_KEY');
    process.env.ENCRYPTION_KEY = saved;
  });
});
