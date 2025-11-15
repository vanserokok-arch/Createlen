# Createlen

GitHub App webhook listener and deployment infrastructure for the Createlen project.

## Overview

This repository contains a webhook listener service for a GitHub App, along with deployment automation scripts and configuration files for deploying on Ubuntu/Debian servers.

## Components

- **webhook/webhook-handler.js** - Express.js webhook listener that verifies GitHub webhook signatures and logs events
- **deploy/** - Deployment scripts and configuration files
  - `deploy.sh` - Idempotent deployment script for Ubuntu/Debian
  - `nginx.createlen.conf` - Nginx reverse proxy configuration
  - `createlen-webhook.service` - Systemd service unit
- **etc/createlen/.env.example** - Example environment configuration

## Deployment Instructions

### Prerequisites

- Ubuntu/Debian server with sudo access
- Domain name (createlen.kg-keis.ru) pointed to your server
- GitHub App created with webhook events enabled

### Step 1: Generate Webhook Secret

Generate a secure webhook secret:

```bash
openssl rand -hex 32
```

Save this value - you'll need it for both the GitHub App configuration and the server environment file.

### Step 2: Clone Repository

```bash
git clone https://github.com/vanserokok-arch/Createlen.git
cd Createlen
```

### Step 3: Run Deployment Script

```bash
sudo ./deploy/deploy.sh
```

This script will:
- Install Node.js 20
- Install nginx and certbot
- Create required directories
- Set up systemd service
- Configure nginx reverse proxy

### Step 4: Configure Environment Variables

Create the environment file at `/etc/createlen/.env`:

```bash
sudo cp etc/createlen/.env.example /etc/createlen/.env
sudo nano /etc/createlen/.env
```

Fill in the values:
- `PORT=3000`
- `WEBHOOK_SECRET` - The secret you generated in Step 1
- `GH_APP_ID` - Your GitHub App ID
- `GH_PRIVATE_KEY_PATH=/etc/createlen/private-key.pem`
- `GH_INSTALLATION_ID` - Your GitHub App installation ID

### Step 5: Add GitHub App Private Key

Download your GitHub App's private key and place it on the server:

```bash
sudo cp ~/path/to/private-key.pem /etc/createlen/private-key.pem
sudo chown www-data:www-data /etc/createlen/private-key.pem
sudo chmod 600 /etc/createlen/private-key.pem
```

### Step 6: Copy Application Files

```bash
sudo rsync -av /path/to/Createlen/ /opt/createlen/ --exclude .git --exclude node_modules
cd /opt/createlen
sudo -u www-data npm install --production
```

### Step 7: Obtain SSL Certificate

```bash
sudo certbot --nginx -d createlen.kg-keis.ru
```

Follow the prompts to obtain a Let's Encrypt SSL certificate.

### Step 8: Start the Service

```bash
sudo systemctl enable createlen-webhook
sudo systemctl start createlen-webhook
sudo systemctl reload nginx
```

### Step 9: Configure GitHub App

1. Go to your GitHub App settings
2. Update the Webhook URL to: `https://createlen.kg-keis.ru/webhook`
3. Set the Webhook Secret to the value you generated in Step 1
4. Save the changes

## Testing

### Test Health Endpoint

```bash
curl https://createlen.kg-keis.ru/health
```

Expected response:
```json
{"status":"ok","timestamp":"2025-11-15T17:30:00.000Z"}
```

### Test Webhook Locally

You can test the webhook handler locally by sending a test payload with a valid signature:

```bash
# Set environment variables
export WEBHOOK_SECRET="your_secret_here"
export PORT=3000

# Start the handler
node webhook/webhook-handler.js
```

Send a test webhook (in another terminal):
```bash
# Generate signature
payload='{"action":"opened","number":1}'
secret="your_secret_here"
signature=$(echo -n "$payload" | openssl dgst -sha256 -hmac "$secret" -binary | xxd -p)

# Send request
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: issues" \
  -H "X-GitHub-Delivery: test-123" \
  -H "X-Hub-Signature-256: sha256=$signature" \
  -d "$payload"
```

### View Service Logs

```bash
sudo journalctl -u createlen-webhook -f
```

### Check Service Status

```bash
sudo systemctl status createlen-webhook
```

## Repository Secrets

The following secret must be configured in GitHub repository settings for CI/CD:

- `WEBHOOK_SECRET` - Used to verify webhook signatures in CI tests

To add this secret:
1. Go to repository Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `WEBHOOK_SECRET`
4. Value: Your webhook secret (generated with `openssl rand -hex 32`)

## Security Notes

- **Never commit secrets or private keys to the repository**
- The webhook handler verifies all incoming requests using HMAC-SHA256 signatures
- All sensitive data is stored in `/etc/createlen/.env` outside the repository
- The systemd service runs with limited privileges (`www-data` user)
- SSL/TLS is enforced via certbot and Let's Encrypt

## Next Steps

- Implement actual event processing logic in `webhook/webhook-handler.js`
- Add monitoring and alerting for the webhook service
- Set up log rotation for service logs
- Configure firewall rules (allow ports 80, 443, and SSH only)
- Set up automated backup for configuration files
- Consider adding rate limiting to the webhook endpoint

## Troubleshooting

### Service won't start

```bash
# Check logs for errors
sudo journalctl -u createlen-webhook -n 50

# Verify environment file exists and has correct permissions
ls -la /etc/createlen/.env

# Test webhook handler manually
cd /opt/createlen
sudo -u www-data bash -c 'source /etc/createlen/.env && node webhook/webhook-handler.js'
```

### Nginx errors

```bash
# Test nginx configuration
sudo nginx -t

# Check nginx logs
sudo tail -f /var/log/nginx/error.log
```

### SSL certificate issues

```bash
# Verify certificate status
sudo certbot certificates

# Renew certificate manually
sudo certbot renew --dry-run
```

## License

MIT
