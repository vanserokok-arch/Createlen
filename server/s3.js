// server/s3.js — S3 client for artifact storage
// TODO: Add multipart upload support for large files
// TODO: Implement presigned URL generation for secure access
// TODO: Add lifecycle policies documentation

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const S3_BUCKET = process.env.S3_BUCKET;
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID;
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY;
const S3_REGION = process.env.S3_REGION || 'us-east-1';

if (!S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
  console.warn('WARNING: S3 credentials not fully configured. S3 operations will fail.');
}

// Create S3 client
export const s3Client = new S3Client({
  region: S3_REGION,
  credentials: {
    accessKeyId: S3_ACCESS_KEY_ID || '',
    secretAccessKey: S3_SECRET_ACCESS_KEY || '',
  },
});

/**
 * Upload HTML content to S3
 * @param {string} sessionId - Session identifier (used in S3 key)
 * @param {string} htmlContent - HTML content to upload
 * @returns {Promise<string>} Public URL of uploaded file
 */
export async function uploadHtmlToS3(sessionId, htmlContent) {
  const key = `landings/${sessionId}/landing.html`;
  
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: htmlContent,
    ContentType: 'text/html; charset=utf-8',
    // TODO: Add appropriate ACL based on security requirements
    // ACL: 'public-read', // or use bucket policies for public access
  });

  await s3Client.send(command);

  // Construct public URL
  // TODO: Support CloudFront distribution URLs
  const url = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
  return url;
}

/**
 * Upload JSON metadata to S3
 * @param {string} sessionId - Session identifier
 * @param {object} jsonData - JSON data to upload
 * @returns {Promise<string>} Public URL of uploaded file
 */
export async function uploadJsonToS3(sessionId, jsonData) {
  const key = `landings/${sessionId}/landing.json`;
  
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: JSON.stringify(jsonData, null, 2),
    ContentType: 'application/json; charset=utf-8',
  });

  await s3Client.send(command);

  const url = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
  return url;
}
