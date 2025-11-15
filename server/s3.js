// server/s3.js — helper for uploading files to S3 and getting presigned URLs
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

let s3Client = null;

/**
 * Get or create S3 client
 */
export function getS3Client() {
  if (!s3Client) {
    const { S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION } = process.env;
    
    if (!S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY || !S3_REGION) {
      throw new Error('S3 credentials not configured (S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION required)');
    }

    s3Client = new S3Client({
      region: S3_REGION,
      credentials: {
        accessKeyId: S3_ACCESS_KEY_ID,
        secretAccessKey: S3_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
}

/**
 * Upload a file to S3
 * @param {string} key - S3 object key (path)
 * @param {Buffer|string} body - File content
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} - S3 object key
 */
export async function uploadToS3(key, body, contentType = 'application/octet-stream') {
  const client = getS3Client();
  const bucket = process.env.S3_BUCKET;
  
  if (!bucket) {
    throw new Error('S3_BUCKET environment variable not set');
  }

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  await client.send(command);
  return key;
}

/**
 * Get presigned URL for an S3 object (for download/viewing)
 * @param {string} key - S3 object key
 * @param {number} expiresIn - URL expiration in seconds (default 1 hour)
 * @returns {Promise<string>} - Presigned URL
 */
export async function getPresignedUrl(key, expiresIn = 3600) {
  const client = getS3Client();
  const bucket = process.env.S3_BUCKET;
  
  if (!bucket) {
    throw new Error('S3_BUCKET environment variable not set');
  }

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const url = await getSignedUrl(client, command, { expiresIn });
  return url;
}

/**
 * Upload JSON data to S3
 * @param {string} key - S3 object key
 * @param {object} data - JSON data to upload
 * @returns {Promise<string>} - S3 object key
 */
export async function uploadJsonToS3(key, data) {
  const json = JSON.stringify(data, null, 2);
  return uploadToS3(key, json, 'application/json');
}

/**
 * Upload HTML to S3
 * @param {string} key - S3 object key
 * @param {string} html - HTML content
 * @returns {Promise<string>} - S3 object key
 */
export async function uploadHtmlToS3(key, html) {
  return uploadToS3(key, html, 'text/html');
}
