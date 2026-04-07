/**
 * Uploads a file to S3 and returns the public URL.
 * Returns null if S3 is not configured.
 */
export declare function uploadFile(key: string, body: Buffer | Uint8Array, contentType: string): Promise<string | null>;
/**
 * Deletes a file from S3.
 */
export declare function deleteFile(key: string): Promise<void>;
/**
 * Returns a presigned GET URL for the given key.
 */
export declare function getPresignedUrl(key: string, expiresIn?: number): Promise<string>;
//# sourceMappingURL=upload.d.ts.map