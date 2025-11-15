import express from 'express';
import crypto from 'crypto';

const app = express();
const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

if (!WEBHOOK_SECRET) {
  console.error('ERROR: WEBHOOK_SECRET environment variable is not set');
  process.exit(1);
}

// Middleware to capture raw body for signature verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));

// Verify GitHub webhook signature
function verifySignature(req) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    return false;
  }

  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  const digest = 'sha256=' + hmac.update(req.rawBody).digest('hex');
  
  // Check lengths match before timing-safe comparison
  if (signature.length !== digest.length) {
    return false;
  }
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(digest)
    );
  } catch (error) {
    return false;
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Webhook endpoint
// NOTE: This endpoint performs signature verification but does not implement rate limiting.
// For production use, consider adding rate limiting middleware (e.g., express-rate-limit)
// to protect against abuse, especially if webhook secret is compromised.
app.post('/webhook', (req, res) => {
  // Verify signature
  if (!verifySignature(req)) {
    console.warn('Invalid signature received');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = req.headers['x-github-event'];
  const deliveryId = req.headers['x-github-delivery'];
  
  console.log(`[${new Date().toISOString()}] Received ${event} event (delivery: ${deliveryId})`);
  
  // Log event details
  if (req.body.action) {
    console.log(`  Action: ${req.body.action}`);
  }
  if (req.body.repository) {
    console.log(`  Repository: ${req.body.repository.full_name}`);
  }
  if (req.body.sender) {
    console.log(`  Sender: ${req.body.sender.login}`);
  }

  // Respond quickly to acknowledge receipt
  res.status(200).json({ received: true });

  // Process event asynchronously (placeholder for future implementation)
  setImmediate(() => {
    processEvent(event, req.body, deliveryId);
  });
});

// Async event processing (placeholder)
async function processEvent(event, payload, deliveryId) {
  try {
    console.log(`Processing ${event} event ${deliveryId}...`);
    // TODO: Add actual event processing logic here
    // This could include:
    // - Creating/updating issues
    // - Running automated tests
    // - Deploying changes
    // - etc.
  } catch (error) {
    console.error(`Error processing ${event} event ${deliveryId}:`, error);
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`Webhook listener running on port ${PORT}`);
  console.log(`Health check available at: http://localhost:${PORT}/health`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/webhook`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});
