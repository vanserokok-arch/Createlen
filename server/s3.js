// server/s3.js — AWS S3 helper for file uploads and presigned URLs
// Uses @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

let s3Client = null;

/**
 * Get or create S3 client instance
 * @returns {S3Client} Configured S3 client
 */
export function getS3Client() {
  if (!s3Client) {
    const region = process.env.S3_REGION || 'us-east-1';
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    
    if (!accessKeyId || !secretAccessKey) {
      throw new Error('S3 credentials not configured. Set S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY');
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
 * Upload a file to S3
 * @param {string} key - S3 object key (file path)
 * @param {Buffer|string} body - File content
 * @param {string} contentType - MIME type of the file
 * @returns {Promise<string>} S3 object URL
 */
export async function uploadToS3(key, body, contentType = 'application/octet-stream') {
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
    // ServerSideEncryption: 'AES256', // Optional: enable server-side encryption
  });
  
  try {
    await client.send(command);
    
    // Return the public URL (adjust based on your S3 bucket configuration)
    const region = process.env.S3_REGION || 'us-east-1';
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  } catch (err) {
    console.error('Error uploading to S3:', err);
    throw err;
  }
}

/**
 * Generate a presigned URL for downloading a file from S3
 * @param {string} key - S3 object key (file path)
 * @param {number} expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns {Promise<string>} Presigned URL
 */
export async function getPresignedDownloadUrl(key, expiresIn = 3600) {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error('S3_BUCKET environment variable is not set');
  }
  
  const client = getS3Client();
  
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  
  try {
    const url = await getSignedUrl(client, command, { expiresIn });
    return url;
  } catch (err) {
    console.error('Error generating presigned URL:', err);
    throw err;
  }
}

/**
 * Upload JSON data to S3
 * @param {string} key - S3 object key (file path)
 * @param {object} data - JSON data to upload
 * @returns {Promise<string>} S3 object URL
 */
export async function uploadJsonToS3(key, data) {
  const jsonString = JSON.stringify(data, null, 2);
  return uploadToS3(key, jsonString, 'application/json');
}

/**
 * Upload HTML content to S3
 * @param {string} key - S3 object key (file path)
 * @param {string} html - HTML content to upload
 * @returns {Promise<string>} S3 object URL
 */
export async function uploadHtmlToS3(key, html) {
  return uploadToS3(key, html, 'text/html; charset=utf-8');
}

/**
 * Upload a ZIP archive to S3
 * @param {string} key - S3 object key (file path)
 * @param {Buffer} zipBuffer - ZIP file buffer
 * @returns {Promise<string>} S3 object URL
 */
export async function uploadZipToS3(key, zipBuffer) {
  return uploadToS3(key, zipBuffer, 'application/zip');
}

/**
 * Generate a unique S3 key for a session
 * @param {string} sessionId - Session identifier
 * @param {string} filename - File name
 * @returns {string} S3 object key
 */
export function generateS3Key(sessionId, filename) {
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `landings/${timestamp}/${sessionId}/${filename}`;
}
