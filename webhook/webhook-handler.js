import express from 'express';
import crypto from 'crypto';

const app = express();
const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

if (!WEBHOOK_SECRET) {
  console.error('WEBHOOK_SECRET environment variable is required');
  process.exit(1);
}

// Middleware to capture raw body for signature verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));

// Verify GitHub webhook signature
function verifySignature(payload, signature) {
  if (!signature) {
    return false;
  }

  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  } catch (error) {
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
  const delivery = req.headers['x-github-delivery'];

  // Verify signature
  if (!verifySignature(req.rawBody, signature)) {
    console.error('Invalid signature');
    return res.status(401).send('Invalid signature');
  }

  // Log the event
  console.log(`Received event: ${event}, delivery: ${delivery}`);
  console.log(`Payload: ${JSON.stringify(req.body, null, 2)}`);

  // Respond quickly to acknowledge receipt
  res.status(200).json({ received: true });

  // Handle events asynchronously (example)
  setImmediate(() => {
    try {
      handleWebhookEvent(event, req.body);
    } catch (error) {
      console.error('Error handling webhook event:', error);
    }
  });
});

// Event handler (placeholder for actual implementation)
function handleWebhookEvent(event, payload) {
  console.log(`Processing ${event} event...`);
  
  switch (event) {
    case 'push':
      console.log(`Push to ${payload.ref} by ${payload.pusher?.name}`);
      break;
    case 'pull_request':
      console.log(`PR ${payload.action}: ${payload.pull_request?.title}`);
      break;
    case 'issues':
      console.log(`Issue ${payload.action}: ${payload.issue?.title}`);
      break;
    default:
      console.log(`Unhandled event type: ${event}`);
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`Webhook listener running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/webhook`);
});
