// server/s3.js — S3 upload functionality
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// TODO: Add multipart upload for large files
// TODO: Add retry logic with exponential backoff
// TODO: Add CloudFront CDN integration
// TODO: Add signed URL generation for private access
// TODO: Add lifecycle policies for artifact cleanup

const S3_BUCKET = process.env.S3_BUCKET;
const S3_REGION = process.env.S3_REGION || 'us-east-1';
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID;
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY;

if (!S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
  console.warn('WARNING: S3 configuration incomplete. Upload functionality will not work.');
}

// Initialize S3 client
const s3Client = S3_BUCKET ? new S3Client({
  region: S3_REGION,
  credentials: {
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
  },
}) : null;

/**
 * Upload HTML content to S3
 * @param {string} sessionId - Session identifier (used for file naming)
 * @param {string} htmlContent - HTML content to upload
 * @returns {Promise<string>} Public URL of uploaded file
 */
export async function uploadToS3(sessionId, htmlContent) {
  if (!s3Client) {
    throw new Error('S3 client not initialized. Check S3 configuration.');
  }

  const key = `landings/${sessionId}/index.html`;
  
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: htmlContent,
    ContentType: 'text/html',
    ACL: 'public-read', // Make file publicly accessible
    CacheControl: 'max-age=31536000', // Cache for 1 year
  });

  try {
    await s3Client.send(command);
    
    // Construct public URL
    const url = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
    return url;
  } catch (error) {
    console.error('S3 upload failed:', error);
    throw new Error(`Failed to upload to S3: ${error.message}`);
  }
}

/**
 * Upload JSON data to S3
 * @param {string} sessionId - Session identifier
 * @param {object} data - JSON data to upload
 * @returns {Promise<string>} Public URL of uploaded file
 */
export async function uploadJsonToS3(sessionId, data) {
  if (!s3Client) {
    throw new Error('S3 client not initialized. Check S3 configuration.');
  }

  const key = `landings/${sessionId}/data.json`;
  
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: JSON.stringify(data, null, 2),
    ContentType: 'application/json',
    ACL: 'public-read',
  });

  try {
    await s3Client.send(command);
    const url = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
    return url;
  } catch (error) {
    console.error('S3 upload failed:', error);
    throw new Error(`Failed to upload JSON to S3: ${error.message}`);
  }
}

/**
 * Health check for S3 connection
 * @returns {Promise<boolean>} True if S3 is reachable
 */
export async function checkS3Health() {
  if (!s3Client) {
    return false;
  }

  try {
    // Try to list bucket to verify connection
    const { HeadBucketCommand } = await import('@aws-sdk/client-s3');
    const command = new HeadBucketCommand({ Bucket: S3_BUCKET });
    await s3Client.send(command);
    return true;
  } catch (error) {
    console.error('S3 health check failed:', error);
    return false;
  }
}
