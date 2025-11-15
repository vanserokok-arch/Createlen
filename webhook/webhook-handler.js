// Minimal GitHub webhook listener for Createlen
// Usage: set WEBHOOK_SECRET in environment (or via /etc/createlen/.env when running as service)
// npm i express
const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

app.use(express.json({
  verify: (req, res, buf) => { req.rawBody = buf; }
}));

function verifySignature(req) {
  const sig = req.get('x-hub-signature-256') || '';
  if (!sig || !WEBHOOK_SECRET) return false;
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  hmac.update(req.rawBody);
  const digest = 'sha256=' + hmac.digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(sig)); } catch (e) { return false; }
}

app.post('/webhook', (req, res) => {
  if (!verifySignature(req)) {
    console.warn('Invalid webhook signature');
    return res.status(401).send('invalid signature');
  }

  const event = req.get('x-github-event');
  const delivery = req.get('x-github-delivery');
  console.log(new Date().toISOString(), 'event=', event, 'delivery=', delivery);

  // Quick 200 back to GitHub
  res.status(200).send('ok');

  // Async handling placeholder: enqueue job, call CI, etc.
  if (event === 'push') {
    console.log('Push to', req.body.repository && req.body.repository.full_name);
  } else if (event === 'pull_request') {
    console.log('PR', req.body.action, req.body.pull_request && req.body.pull_request.number);
  } else if (event === 'installation') {
    console.log('Installation', req.body.action, req.body.installation && req.body.installation.id);
  } else {
    console.log('Unhandled event', event);
  }
});

app.get('/health', (req, res) => res.status(200).send('ok'));

app.listen(PORT, () => console.log(`Webhook listener started on port ${PORT}`));
