import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3, S3_BUCKET } from './client.js';

// Key naming conventions:
// Product images:       products/{businessId}/{productId}/{filename}
// Training data:        training/{businessId}/{filename}
// CSV imports:          imports/{businessId}/{timestamp}/{filename}
// Support attachments:  support/{businessId}/{ticketId}/{filename}

/**
 * Uploads a file to S3 and returns the public URL (or key if no public endpoint configured).
 */
export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );

  const endpoint = process.env.S3_ENDPOINT;
  if (endpoint) {
    return `${endpoint.replace(/\/$/, '')}/${S3_BUCKET}/${key}`;
  }
  return key;
}

/**
 * Deletes a file from S3.
 */
export async function deleteFile(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    }),
  );
}

/**
 * Returns a presigned GET URL for the given key.
 */
export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }), { expiresIn });
}
