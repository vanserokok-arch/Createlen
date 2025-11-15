// server/s3.js — AWS S3 helper for uploading files and generating presigned URLs
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

let s3Client = null;

/**
 * Get or create S3 client
 */
export function getS3Client() {
  if (!s3Client) {
    const S3_REGION = process.env.S3_REGION || 'us-east-1';
    const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID;
    const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY;
    
    if (!S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
      throw new Error('S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be set');
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
 * @param {string} key - S3 object key (filename/path)
 * @param {Buffer|string} body - File content
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} S3 object URL
 */
export async function uploadToS3(key, body, contentType = 'application/octet-stream') {
  const S3_BUCKET = process.env.S3_BUCKET;
  if (!S3_BUCKET) {
    throw new Error('S3_BUCKET environment variable is not set');
  }
  
  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  });
  
  try {
    await client.send(command);
    const url = `https://${S3_BUCKET}.s3.${process.env.S3_REGION || 'us-east-1'}.amazonaws.com/${key}`;
    console.log(`File uploaded to S3: ${url}`);
    return url;
  } catch (error) {
    console.error('S3 upload error:', error);
    throw error;
  }
}

/**
 * Generate a presigned URL for downloading a file from S3
 * @param {string} key - S3 object key
 * @param {number} expiresIn - URL expiration time in seconds (default: 3600)
 * @returns {Promise<string>} Presigned URL
 */
export async function getPresignedUrl(key, expiresIn = 3600) {
  const S3_BUCKET = process.env.S3_BUCKET;
  if (!S3_BUCKET) {
    throw new Error('S3_BUCKET environment variable is not set');
  }
  
  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });
  
  try {
    const url = await getSignedUrl(client, command, { expiresIn });
    return url;
  } catch (error) {
    console.error('Presigned URL generation error:', error);
    throw error;
  }
}

/**
 * Upload JSON data to S3
 * @param {string} sessionId - Session identifier for unique key
 * @param {object} data - JSON data to upload
 * @returns {Promise<string>} S3 object URL
 */
export async function uploadJSONToS3(sessionId, data) {
  const key = `results/${sessionId}.json`;
  const body = JSON.stringify(data, null, 2);
  return uploadToS3(key, body, 'application/json');
}

// TODO: Add support for multipart uploads for large files
// TODO: Add retry logic with exponential backoff
// TODO: Add support for Supabase Storage as alternative to S3
// TODO: Add file deletion functionality
