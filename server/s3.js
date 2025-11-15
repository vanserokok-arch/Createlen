// server/s3.js - Helper for uploading files to S3 and generating presigned URLs
// Uses AWS SDK v3 for S3 operations

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

let s3Client = null;

/**
 * Initialize S3 client
 * Uses S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and S3_REGION environment variables
 */
export function initS3() {
  if (s3Client) return s3Client;

  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const region = process.env.S3_REGION || 'us-east-1';

  if (!accessKeyId || !secretAccessKey) {
    console.warn('WARNING: S3 credentials not set. S3 operations will fail.');
    return null;
  }

  s3Client = new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  console.log('S3 client initialized for region:', region);
  return s3Client;
}

/**
 * Get S3 client instance
 * @returns {S3Client} S3 client instance
 */
export function getS3Client() {
  if (!s3Client) {
    return initS3();
  }
  return s3Client;
}

/**
 * Upload file to S3
 * @param {string} key - S3 object key (path)
 * @param {string|Buffer} content - File content
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} S3 object URL
 */
export async function uploadToS3(key, content, contentType = 'application/json') {
  const client = getS3Client();
  if (!client) {
    throw new Error('S3 client not initialized');
  }

  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error('S3_BUCKET environment variable not set');
  }

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: typeof content === 'string' ? Buffer.from(content, 'utf-8') : content,
    ContentType: contentType,
  });

  try {
    await client.send(command);
    const url = `https://${bucket}.s3.${process.env.S3_REGION || 'us-east-1'}.amazonaws.com/${key}`;
    console.log('Uploaded to S3:', key);
    return url;
  } catch (error) {
    console.error('S3 upload error:', error);
    throw error;
  }
}

/**
 * Generate presigned URL for S3 object
 * @param {string} key - S3 object key
 * @param {number} expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns {Promise<string>} Presigned URL
 */
export async function getPresignedUrl(key, expiresIn = 3600) {
  const client = getS3Client();
  if (!client) {
    throw new Error('S3 client not initialized');
  }

  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error('S3_BUCKET environment variable not set');
  }

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  try {
    const url = await getSignedUrl(client, command, { expiresIn });
    console.log('Generated presigned URL for:', key);
    return url;
  } catch (error) {
    console.error('Presigned URL generation error:', error);
    throw error;
  }
}

/**
 * Upload JSON data to S3
 * @param {string} sessionId - Session identifier
 * @param {Object} data - JSON data to upload
 * @returns {Promise<string>} S3 object URL
 */
export async function uploadJSON(sessionId, data) {
  const key = `sessions/${sessionId}/landing.json`;
  const content = JSON.stringify(data, null, 2);
  return uploadToS3(key, content, 'application/json');
}

/**
 * Upload HTML content to S3
 * @param {string} sessionId - Session identifier
 * @param {string} html - HTML content
 * @returns {Promise<string>} S3 object URL
 */
export async function uploadHTML(sessionId, html) {
  const key = `sessions/${sessionId}/landing.html`;
  return uploadToS3(key, html, 'text/html; charset=utf-8');
}

/**
 * Generate presigned URLs for session artifacts
 * @param {string} sessionId - Session identifier
 * @param {number} expiresIn - URL expiration time in seconds
 * @returns {Promise<Object>} Object with presigned URLs
 */
export async function getSessionPresignedUrls(sessionId, expiresIn = 3600) {
  return {
    json: await getPresignedUrl(`sessions/${sessionId}/landing.json`, expiresIn),
    html: await getPresignedUrl(`sessions/${sessionId}/landing.html`, expiresIn),
  };
}

// TODO: Add more S3 operations as needed:
// - deleteObject(key)
// - listObjects(prefix)
// - copyObject(sourceKey, destKey)
