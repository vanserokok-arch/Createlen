// server/s3.js - S3 storage helper for artifacts
// Uses AWS SDK v3 for S3 operations and presigned URLs
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

let s3Client = null;

/**
 * Get or create S3 client instance
 * @returns {S3Client} S3 client instance
 */
function getS3Client() {
  if (!s3Client) {
    const { S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env;
    
    if (!S3_REGION || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
      console.warn('S3 credentials not configured - storage operations will fail');
      return null;
    }

    s3Client = new S3Client({
      region: S3_REGION,
      credentials: {
        accessKeyId: S3_ACCESS_KEY_ID,
        secretAccessKey: S3_SECRET_ACCESS_KEY,
      },
      // TODO: Add custom endpoint for S3-compatible services (e.g., DigitalOcean Spaces)
      // TODO: Add retry configuration
    });
  }
  return s3Client;
}

/**
 * Upload buffer to S3
 * @param {Buffer|string} buffer - Data to upload
 * @param {string} key - S3 object key (path)
 * @param {string} contentType - MIME type (default: application/octet-stream)
 * @returns {Promise<string>} S3 object URL
 */
export async function uploadBuffer(buffer, key, contentType = 'application/octet-stream') {
  const client = getS3Client();
  if (!client) throw new Error('S3 not configured');

  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error('S3_BUCKET not configured');

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    // TODO: Add ACL configuration
    // TODO: Add metadata support
    // TODO: Add server-side encryption
  });

  try {
    await client.send(command);
    const region = process.env.S3_REGION;
    // Return public URL (may need adjustment based on bucket configuration)
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  } catch (err) {
    console.error('S3 upload failed:', err.message);
    throw new Error(`Failed to upload to S3: ${err.message}`);
  }
}

/**
 * Get presigned URL for S3 object (for temporary access)
 * @param {string} key - S3 object key
 * @param {number} expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
 * @returns {Promise<string>} Presigned URL
 */
export async function getPresignedUrl(key, expiresIn = 3600) {
  const client = getS3Client();
  if (!client) throw new Error('S3 not configured');

  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error('S3_BUCKET not configured');

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  try {
    const url = await getSignedUrl(client, command, { expiresIn });
    return url;
  } catch (err) {
    console.error('Failed to generate presigned URL:', err.message);
    throw new Error(`Failed to generate presigned URL: ${err.message}`);
  }
}

/**
 * Upload JSON data as a file to S3
 * @param {object} data - JSON data to upload
 * @param {string} key - S3 object key
 * @returns {Promise<string>} S3 object URL
 */
export async function uploadJSON(data, key) {
  const buffer = Buffer.from(JSON.stringify(data, null, 2), 'utf-8');
  return uploadBuffer(buffer, key, 'application/json');
}

/**
 * Upload HTML content to S3
 * @param {string} html - HTML content
 * @param {string} key - S3 object key
 * @returns {Promise<string>} S3 object URL
 */
export async function uploadHTML(html, key) {
  const buffer = Buffer.from(html, 'utf-8');
  return uploadBuffer(buffer, key, 'text/html');
}

// TODO: Add support for multipart uploads for large files
// TODO: Add object deletion functionality
// TODO: Add object listing functionality
// TODO: Add support for Supabase Storage as alternative to S3
