import express from 'express';
import crypto from 'crypto';
import { config } from 'dotenv';

config();

const app = express();
const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

if (!WEBHOOK_SECRET) {
  console.error('ERROR: WEBHOOK_SECRET environment variable is required');
  process.exit(1);
}

// Middleware to capture raw body for signature verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));

/**
 * Verify GitHub webhook signature using X-Hub-Signature-256
 * @param {string} signature - The signature from X-Hub-Signature-256 header
 * @param {string} payload - Raw request body
 * @returns {boolean} - True if signature is valid
 */
function verifySignature(signature, payload) {
  if (!signature) {
    return false;
  }

  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(digest)
    );
  } catch (error) {
    // Handle comparison errors (e.g., different lengths)
    return false;
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Webhook endpoint
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const event = req.headers['x-github-event'];
  
  // Verify signature
  if (!verifySignature(signature, req.rawBody)) {
    console.error('Webhook signature verification failed');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Log the event
  console.log(`Received webhook event: ${event}`);
  console.log('Event payload:', JSON.stringify(req.body, null, 2));

  // Respond quickly to GitHub
  res.status(200).json({ received: true });

  // Process webhook asynchronously (placeholder for future logic)
  setImmediate(() => {
    try {
      processWebhook(event, req.body);
    } catch (error) {
      console.error('Error processing webhook:', error);
    }
  });
});

/**
 * Process webhook events asynchronously
 * @param {string} event - GitHub event type
 * @param {object} payload - Event payload
 */
function processWebhook(event, payload) {
  // Placeholder for webhook processing logic
  console.log(`Processing ${event} event...`);
  
  // Add your webhook processing logic here
  // For example:
  // - Handle installation events
  // - Process issue/PR comments
  // - Trigger builds or deployments
  // - Update databases
}

// Start server
app.listen(PORT, () => {
  console.log(`Webhook listener running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/webhook`);
});
