# Createlen Webhook Deployment Guide

This repository contains a GitHub App webhook listener and deployment infrastructure for the Createlen project.

## Overview

The webhook listener is a Node.js Express application that:
- Receives and verifies GitHub webhook events using HMAC-SHA256 signatures
- Provides a health check endpoint
- Logs all incoming events for debugging
- Can be extended to automate workflows based on GitHub events

## Quick Start

### Prerequisites

- Ubuntu/Debian server with root access
- Domain name (createlen.kg-keis.ru) pointing to your server
- GitHub App created with webhook configured

### Deployment Steps

1. **Clone the repository** on your server:
   ```bash
   git clone https://github.com/vanserokok-arch/Createlen.git
   cd Createlen
   ```

2. **Run the deployment script** (as root):
   ```bash
   sudo ./deploy/deploy.sh
   ```

   This script will:
   - Install Node.js 20, nginx, and certbot
   - Create necessary directories
   - Install npm dependencies
   - Copy systemd and nginx configuration files
   - Create a template environment file

3. **Configure environment variables**:
   
   Edit `/etc/createlen/.env` and fill in the actual values:
   ```bash
   sudo nano /etc/createlen/.env
   ```

   Generate a webhook secret:
   ```bash
   openssl rand -hex 32
   ```

   Update the environment file with:
   - `WEBHOOK_SECRET` - The generated secret (must match GitHub App settings)
   - `GH_APP_ID` - Your GitHub App ID
   - `GH_PRIVATE_KEY_PATH` - Path to your GitHub App private key
   - `GH_INSTALLATION_ID` - Your GitHub App installation ID

4. **Place your GitHub App private key**:
   ```bash
   sudo nano /etc/createlen/private-key.pem
   # Paste your private key content
   sudo chmod 600 /etc/createlen/private-key.pem
   sudo chown www-data:www-data /etc/createlen/private-key.pem
   ```

5. **Obtain SSL certificate** with certbot:
   ```bash
   sudo certbot --nginx -d createlen.kg-keis.ru --email your-email@example.com --agree-tos --non-interactive
   ```

6. **Start the webhook service**:
   ```bash
   sudo systemctl start createlen-webhook
   sudo systemctl status createlen-webhook
   ```

7. **Update GitHub App webhook URL**:
   - Go to your GitHub App settings
   - Set Webhook URL to: `https://createlen.kg-keis.ru/webhook`
   - Set Webhook Secret to the same value as `WEBHOOK_SECRET` in your `.env` file
   - Save the settings

## Testing

### Health Check

Test the health endpoint:
```bash
curl https://createlen.kg-keis.ru/health
```

Expected response:
```json
{"status":"ok","timestamp":"2025-11-15T17:30:00.000Z"}
```

### Webhook Testing

You can test webhook delivery from GitHub:
1. Go to your GitHub App settings
2. Navigate to "Advanced" tab
3. Find recent webhook deliveries
4. Click "Redeliver" to resend a webhook event

Check the logs:
```bash
sudo journalctl -u createlen-webhook -f
```

### Local Testing

For local development/testing:
```bash
# Set environment variables
export PORT=3000
export WEBHOOK_SECRET=$(openssl rand -hex 32)

# Run the webhook handler
node webhook/webhook-handler.js
```

Send a test webhook (with proper signature):
```bash
# This requires the webhook secret to generate a valid signature
# Use tools like curl or Postman with proper HMAC-SHA256 signature in X-Hub-Signature-256 header
```

## Monitoring

### View Logs

```bash
# Follow logs in real-time
sudo journalctl -u createlen-webhook -f

# View recent logs
sudo journalctl -u createlen-webhook -n 100

# View logs from specific time
sudo journalctl -u createlen-webhook --since "1 hour ago"
```

### Service Management

```bash
# Check service status
sudo systemctl status createlen-webhook

# Restart service
sudo systemctl restart createlen-webhook

# Stop service
sudo systemctl stop createlen-webhook

# View service logs
sudo journalctl -u createlen-webhook
```

## Security Notes

### Secrets Management

- **Never commit secrets to the repository**
- Store all sensitive data in `/etc/createlen/.env`
- Keep the `.env` file readable only by `www-data` user (chmod 600)
- Rotate the webhook secret periodically
- Keep your GitHub App private key secure

### Webhook Secret Generation

Always generate a strong webhook secret:
```bash
openssl rand -hex 32
```

This secret must be:
1. Stored in `/etc/createlen/.env` as `WEBHOOK_SECRET`
2. Configured in your GitHub App webhook settings
3. Never committed to version control

### Repository Secrets

For CI/CD, add `WEBHOOK_SECRET` to your GitHub repository secrets:
1. Go to repository Settings → Secrets and variables → Actions
2. Create a new repository secret named `WEBHOOK_SECRET`
3. Use the same value as in your production `.env` file

## CI/CD

The `.github/workflows/ci.yml` workflow:
- Runs on push and pull requests
- Uses Node.js 20
- Installs dependencies
- Performs basic checks
- Verifies file existence and permissions
- Uses `WEBHOOK_SECRET` from repository secrets

## Next Steps

1. **Extend webhook handler** to perform actions based on events:
   - Auto-deploy on push to main branch
   - Create issues for failed builds
   - Notify on pull request reviews
   - Automate project management tasks

2. **Add authentication** for GitHub API calls:
   - Use the private key to generate JWT tokens
   - Authenticate as a GitHub App installation
   - Make API calls to manage repositories

3. **Add more robust error handling**:
   - Retry failed webhook processing
   - Queue webhook events for async processing
   - Add monitoring and alerting

4. **Implement rate limiting**:
   - Protect against DoS attacks
   - Implement request throttling

5. **Add webhook event filtering**:
   - Only process specific event types
   - Ignore events from certain sources

## Troubleshooting

### Service won't start

Check logs for errors:
```bash
sudo journalctl -u createlen-webhook -n 50
```

Common issues:
- Missing or invalid `WEBHOOK_SECRET` in `.env`
- Port 3000 already in use
- Permission issues with `/opt/createlen` or `/etc/createlen`

### Webhook signature verification fails

Ensure:
- `WEBHOOK_SECRET` in `.env` matches GitHub App settings exactly
- No extra whitespace in the secret value
- Secret is properly set in GitHub App webhook configuration

### nginx returns 502 Bad Gateway

Check if webhook service is running:
```bash
sudo systemctl status createlen-webhook
```

Test if the service is listening:
```bash
curl http://127.0.0.1:3000/health
```

### SSL certificate issues

Re-run certbot:
```bash
sudo certbot --nginx -d createlen.kg-keis.ru
```

Test certificate renewal:
```bash
sudo certbot renew --dry-run
```

## Files Structure

```
.
├── webhook/
│   └── webhook-handler.js       # Express webhook listener
├── deploy/
│   ├── deploy.sh                # Deployment script
│   ├── nginx.createlen.conf     # Nginx configuration
│   └── createlen-webhook.service # Systemd service unit
├── etc/
│   └── createlen/
│       └── .env.example         # Example environment variables
└── .github/
    └── workflows/
        └── ci.yml               # CI workflow
```

## Support

For issues or questions:
- Create an issue in the repository
- Check logs with `journalctl -u createlen-webhook`
- Review nginx logs: `sudo tail -f /var/log/nginx/error.log`