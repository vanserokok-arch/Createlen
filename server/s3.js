// server/s3.js — AWS S3 helper for file uploads and presigned URLs
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

let s3Client = null;

/**
 * Initialize S3 client with credentials from environment variables
 * @returns {S3Client} Configured S3 client instance
 */
export function getS3Client() {
  if (!s3Client) {
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    const region = process.env.S3_REGION || 'us-east-1';

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be set');
    }

    s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    });
  }
  return s3Client;
}

/**
 * Upload a file to S3
 * @param {string} key - S3 object key (path/filename)
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
    ContentType: contentType
  });

  await client.send(command);
  
  // Return public URL (assumes public bucket or presigned URL will be used)
  const region = process.env.S3_REGION || 'us-east-1';
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

/**
 * Generate a presigned URL for downloading a file from S3
 * @param {string} key - S3 object key
 * @param {number} expiresIn - Expiration time in seconds (default: 1 hour)
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
    Key: key
  });

  // Generate presigned URL valid for specified duration
  const url = await getSignedUrl(client, command, { expiresIn });
  return url;
}

/**
 * Upload JSON data to S3 and return presigned URL
 * TODO: Add error handling and retry logic for production
 * @param {string} sessionId - Session identifier for filename
 * @param {object} data - JSON data to upload
 * @returns {Promise<string>} Presigned URL for the uploaded file
 */
export async function uploadJsonResult(sessionId, data) {
  const key = `results/${sessionId}/landing.json`;
  const body = JSON.stringify(data, null, 2);
  
  await uploadToS3(key, body, 'application/json');
  
  // Generate presigned URL valid for 7 days
  const url = await getPresignedUrl(key, 7 * 24 * 3600);
  return url;
}
