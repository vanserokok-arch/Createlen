// server/s3.js — AWS S3 helper for file uploads and presigned URLs
// Supports both AWS S3 and Supabase Storage (S3-compatible)

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

let s3Client = null;

/**
 * Initialize S3 client
 * Supports both AWS S3 and S3-compatible storage (e.g., Supabase)
 */
export function initS3Client() {
  if (s3Client) return s3Client;

  const {
    S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY,
    S3_REGION = 'us-east-1',
    S3_ENDPOINT,
  } = process.env;

  if (!S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
    throw new Error('S3 credentials not configured (S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY)');
  }

  const clientConfig = {
    region: S3_REGION,
    credentials: {
      accessKeyId: S3_ACCESS_KEY_ID,
      secretAccessKey: S3_SECRET_ACCESS_KEY,
    },
  };

  // Support for S3-compatible storage (e.g., Supabase Storage)
  if (S3_ENDPOINT) {
    clientConfig.endpoint = S3_ENDPOINT;
    clientConfig.forcePathStyle = true; // Required for some S3-compatible services
  }

  s3Client = new S3Client(clientConfig);
  return s3Client;
}

/**
 * Get S3 client instance
 */
export function getS3Client() {
  if (!s3Client) {
    return initS3Client();
  }
  return s3Client;
}

/**
 * Upload file to S3
 * @param {string} key - S3 object key (path)
 * @param {Buffer|string} body - File content
 * @param {string} contentType - MIME type
 * @returns {Promise<{key: string, bucket: string}>}
 */
export async function uploadFile(key, body, contentType = 'application/octet-stream') {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error('S3_BUCKET environment variable is not set');
  }

  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  await client.send(command);
  
  return {
    key,
    bucket,
  };
}

/**
 * Generate presigned URL for downloading file
 * @param {string} key - S3 object key
 * @param {number} expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns {Promise<string>} Presigned URL
 */
export async function getPresignedUrl(key, expiresIn = 3600) {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error('S3_BUCKET environment variable is not set');
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
 * @param {string} key - S3 object key
 * @param {Object} data - JSON data to upload
 * @returns {Promise<{key: string, bucket: string}>}
 */
export async function uploadJSON(key, data) {
  const jsonString = JSON.stringify(data, null, 2);
  return uploadFile(key, jsonString, 'application/json');
}

/**
 * Upload HTML file to S3
 * @param {string} key - S3 object key
 * @param {string} html - HTML content
 * @returns {Promise<{key: string, bucket: string}>}
 */
export async function uploadHTML(key, html) {
  return uploadFile(key, html, 'text/html; charset=utf-8');
}

/**
 * Generate S3 key for session artifacts
 * @param {string} sessionId - Session ID
 * @param {string} filename - File name
 * @returns {string} S3 key
 */
export function getSessionKey(sessionId, filename) {
  // Use date-based prefix for better organization
  const date = new Date().toISOString().split('T')[0];
  return `landings/${date}/${sessionId}/${filename}`;
}

// TODO: Add support for multipart uploads for large files
// TODO: Add retry logic for failed uploads
// TODO: Add support for listing/deleting objects
// TODO: Add support for bucket lifecycle policies configuration

export default {
  initS3Client,
  getS3Client,
  uploadFile,
  getPresignedUrl,
  uploadJSON,
  uploadHTML,
  getSessionKey,
};
