// server/s3.js - AWS S3 helper for file uploads and presigned URLs
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

let s3Client = null;

/**
 * Get or create S3 client
 * @returns {S3Client}
 */
export function getS3Client() {
  if (!s3Client) {
    const region = process.env.S3_REGION || 'us-east-1';
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('S3 credentials not configured (S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY)');
    }

    s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return s3Client;
}

/**
 * Upload file to S3
 * @param {string} key - Object key (path in bucket)
 * @param {Buffer|string} body - File content
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} - S3 object URL
 */
export async function uploadFile(key, body, contentType = 'application/octet-stream') {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error('S3_BUCKET not configured');
  }

  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  await client.send(command);
  
  // Return public URL (if bucket is public) or use presigned URL
  const region = process.env.S3_REGION || 'us-east-1';
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

/**
 * Get presigned URL for downloading a file from S3
 * @param {string} key - Object key
 * @param {number} expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns {Promise<string>} - Presigned URL
 */
export async function getPresignedUrl(key, expiresIn = 3600) {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error('S3_BUCKET not configured');
  }

  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const url = await getSignedUrl(client, command, { expiresIn });
  return url;
}

/**
 * Upload JSON data to S3
 * @param {string} key - Object key
 * @param {object} data - JSON data to upload
 * @returns {Promise<string>} - S3 object URL
 */
export async function uploadJSON(key, data) {
  return uploadFile(key, JSON.stringify(data, null, 2), 'application/json');
}

/**
 * Upload HTML content to S3
 * @param {string} key - Object key
 * @param {string} html - HTML content
 * @returns {Promise<string>} - S3 object URL
 */
export async function uploadHTML(key, html) {
  return uploadFile(key, html, 'text/html');
}
