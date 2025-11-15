// server/s3.js — AWS S3 helper functions
// Provides upload functionality and presigned URL generation
// TODO: Add error handling for network failures
// TODO: Add retry logic for failed uploads
// TODO: Add support for multipart uploads for large files

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const S3_BUCKET = process.env.S3_BUCKET;
const S3_REGION = process.env.S3_REGION || 'us-east-1';
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID;
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY;

// Initialize S3 client
let s3Client = null;

function getS3Client() {
  if (!s3Client) {
    if (!S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY || !S3_BUCKET) {
      throw new Error('S3 credentials not configured. Set S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and S3_BUCKET.');
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
 * @param {string|Buffer} body - File content
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} - Public URL or presigned URL
 */
export async function uploadToS3(key, body, contentType = 'application/octet-stream') {
  const client = getS3Client();
  
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    // TODO: Add metadata for tracking (e.g., session ID, timestamp)
    // Metadata: {
    //   uploadedAt: new Date().toISOString(),
    // },
  });
  
  try {
    await client.send(command);
    
    // Return presigned URL for security (recommended over public URLs)
    // This ensures controlled access even if bucket is private
    const presignedUrl = await getPresignedUrl(key, 3600); // 1 hour expiration
    console.log(`Uploaded to S3: ${key}`);
    
    return presignedUrl;
  } catch (error) {
    console.error('S3 upload failed:', error);
    throw new Error(`Failed to upload to S3: ${error.message}`);
  }
}

/**
 * Generate a presigned URL for downloading a file from S3
 * @param {string} key - S3 object key
 * @param {number} expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns {Promise<string>} - Presigned URL
 */
export async function getPresignedUrl(key, expiresIn = 3600) {
  const client = getS3Client();
  
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });
  
  try {
    const url = await getSignedUrl(client, command, { expiresIn });
    console.log(`Generated presigned URL for: ${key}`);
    return url;
  } catch (error) {
    console.error('Failed to generate presigned URL:', error);
    throw new Error(`Failed to generate presigned URL: ${error.message}`);
  }
}

/**
 * Check if S3 is configured
 * @returns {boolean}
 */
export function isS3Configured() {
  return !!(S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY && S3_BUCKET);
}

// TODO: Add function to delete objects from S3
// TODO: Add function to list objects in a prefix
// TODO: Add function to check if object exists
