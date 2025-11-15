// server/s3.js - Helper for AWS S3 file uploads and presigned URLs
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

let s3Client;

/**
 * Initialize S3 client
 * Uses environment variables: S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION
 */
export function getS3Client() {
  if (!s3Client) {
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    const region = process.env.S3_REGION || 'us-east-1';

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY environment variables are required');
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
 * @param {string} key - S3 object key (path in bucket)
 * @param {Buffer|string} body - File content
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} S3 object key
 */
export async function uploadFile(key, body, contentType = 'application/octet-stream') {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error('S3_BUCKET environment variable is required');
  }

  const client = getS3Client();
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
 * Generate presigned URL for downloading an object
 * @param {string} key - S3 object key
 * @param {number} expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns {Promise<string>} Presigned URL
 */
export async function getPresignedUrl(key, expiresIn = 3600) {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error('S3_BUCKET environment variable is required');
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
 * Upload generated landing artifacts to S3
 * @param {string} sessionId - Session identifier for organizing files
 * @param {object} data - Generated landing data (JSON)
 * @param {string} html - Generated HTML content
 * @returns {Promise<object>} Object with keys for uploaded files
 */
export async function uploadLandingArtifacts(sessionId, data, html) {
  const timestamp = Date.now();
  
  // TODO: Add proper folder structure, e.g., landings/{sessionId}/{timestamp}/
  const jsonKey = `landings/${sessionId}/${timestamp}/landing.json`;
  const htmlKey = `landings/${sessionId}/${timestamp}/landing.html`;

  await Promise.all([
    uploadFile(jsonKey, JSON.stringify(data, null, 2), 'application/json'),
    uploadFile(htmlKey, html, 'text/html'),
  ]);

  return {
    jsonKey,
    htmlKey,
    sessionId,
    timestamp,
  };
}

/**
 * Get presigned URLs for landing artifacts
 * @param {object} keys - Object with jsonKey and htmlKey
 * @returns {Promise<object>} Object with presigned URLs
 */
export async function getArtifactUrls(keys) {
  const [jsonUrl, htmlUrl] = await Promise.all([
    getPresignedUrl(keys.jsonKey),
    getPresignedUrl(keys.htmlKey),
  ]);

  return {
    jsonUrl,
    htmlUrl,
  };
}
