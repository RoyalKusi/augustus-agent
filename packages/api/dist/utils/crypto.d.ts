export interface EncryptedData {
    iv: string;
    tag: string;
    ciphertext: string;
}
/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns a JSON string containing iv, tag, and ciphertext (all hex-encoded).
 */
export declare function encrypt(text: string): string;
/**
 * Decrypts an AES-256-GCM encrypted string produced by `encrypt`.
 * Accepts either a JSON string or a pre-parsed EncryptedData object.
 */
export declare function decrypt(encryptedData: string | EncryptedData): string;
//# sourceMappingURL=crypto.d.ts.map