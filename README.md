# Createlen

GitHub App webhook listener and deployment infrastructure for the Createlen project.

## Quick Start

### Prerequisites
- Node.js 20 or higher
- Ubuntu/Debian server (for production deployment)
- GitHub App created with webhook configured

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/vanserokok-arch/Createlen.git
cd Createlen
```

2. Install dependencies:
```bash
npm install
```

3. Create a local environment file:
```bash
cp etc/createlen/.env.example .env
```

4. Generate a webhook secret:
```bash
openssl rand -hex 32
```

5. Edit `.env` and add your credentials:
```env
PORT=3000
WEBHOOK_SECRET=<your-generated-secret>
GH_APP_ID=<your-github-app-id>
GH_PRIVATE_KEY_PATH=./github-app-private-key.pem
GH_INSTALLATION_ID=<your-installation-id>
```

6. Start the webhook listener:
```bash
node webhook/webhook-handler.js
```

7. Test the health endpoint:
```bash
curl http://localhost:3000/health
```

## Production Deployment

### Automated Deployment on Ubuntu/Debian

The `deploy/deploy.sh` script provides an idempotent deployment that:
- Installs Node.js 20
- Installs and configures nginx
- Installs certbot for SSL certificates
- Sets up systemd service
- Configures proper permissions

Run the deployment script as root:
```bash
sudo ./deploy/deploy.sh
```

The script will prompt you for manual steps where needed:
1. Copying application files to `/opt/createlen`
2. Creating `/etc/createlen/.env` with secrets
3. Running certbot to obtain SSL certificate

### Manual Configuration Steps

#### 1. Generate Webhook Secret
```bash
openssl rand -hex 32
```
Save this secret - you'll need it in two places:
- In `/etc/createlen/.env` (server)
- In your GitHub App webhook configuration

#### 2. Configure Environment Variables

Create `/etc/createlen/.env` based on `etc/createlen/.env.example`:
```bash
sudo mkdir -p /etc/createlen
sudo cp etc/createlen/.env.example /etc/createlen/.env
sudo nano /etc/createlen/.env
```

Fill in all required values:
- `PORT`: Port for webhook listener (default: 3000)
- `WEBHOOK_SECRET`: The secret you generated above
- `GH_APP_ID`: Your GitHub App ID (from GitHub App settings)
- `GH_PRIVATE_KEY_PATH`: Path to your GitHub App private key
- `GH_INSTALLATION_ID`: Your app installation ID

#### 3. Set Up GitHub App Private Key
```bash
# Copy your private key to the server
sudo cp github-app-private-key.pem /etc/createlen/
sudo chown www-data:www-data /etc/createlen/github-app-private-key.pem
sudo chmod 600 /etc/createlen/github-app-private-key.pem
```

#### 4. Obtain SSL Certificate
```bash
sudo certbot --nginx -d createlen.kg-keis.ru
```

This will:
- Verify domain ownership
- Obtain SSL certificate from Let's Encrypt
- Automatically configure nginx for HTTPS

#### 5. Update GitHub App Webhook URL

In your GitHub App settings (https://github.com/settings/apps):
1. Go to "Webhook" section
2. Set Webhook URL to: `https://createlen.kg-keis.ru/webhook`
3. Set Webhook secret to the value you generated
4. Select events you want to receive
5. Ensure webhook is set to "Active"

### Service Management

Start/stop/restart the webhook service:
```bash
sudo systemctl start createlen-webhook
sudo systemctl stop createlen-webhook
sudo systemctl restart createlen-webhook
sudo systemctl status createlen-webhook
```

View logs:
```bash
# Follow logs in real-time
sudo journalctl -u createlen-webhook -f

# View recent logs
sudo journalctl -u createlen-webhook -n 100
```

### Testing

#### Test Health Endpoint
```bash
curl https://createlen.kg-keis.ru/health
```

Expected response:
```json
{"status":"ok","timestamp":"2025-11-15T17:30:00.000Z"}
```

#### Test Webhook Endpoint

From GitHub, you can redeliver a webhook event to test:
1. Go to your GitHub App settings
2. Click "Advanced" tab
3. Find a recent delivery
4. Click "Redeliver"

Or test locally with curl (signature verification will fail without proper signature):
```bash
curl -X POST https://createlen.kg-keis.ru/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: ping" \
  -d '{"zen":"Testing is good","hook_id":123}'
```

### Security Notes

**IMPORTANT**: Never commit actual secrets to the repository!

- The `.env.example` file is for documentation only
- Real secrets should only exist in `/etc/createlen/.env` on the server
- The private key should never be committed to version control
- Use GitHub Secrets for CI/CD workflows
- Webhook signature verification is mandatory and cannot be disabled

### Troubleshooting

#### Service won't start
Check logs for errors:
```bash
sudo journalctl -u createlen-webhook -n 50
```

Common issues:
- Missing environment variables in `/etc/createlen/.env`
- Invalid private key path or permissions
- Port 3000 already in use

#### Webhook returns 401
- Verify webhook secret matches in both GitHub App settings and `/etc/createlen/.env`
- Check that webhook secret is correctly set in environment

#### nginx errors
Test nginx configuration:
```bash
sudo nginx -t
```

Check nginx logs:
```bash
sudo tail -f /var/log/nginx/createlen-error.log
```

## CI/CD

The repository includes a CI workflow (`.github/workflows/ci.yml`) that:
- Runs on Node.js 20
- Installs dependencies
- Validates webhook handler syntax
- Checks deployment script syntax
- Scans for hardcoded secrets
- Uses `WEBHOOK_SECRET` from repository secrets

To set up CI:
1. Go to repository Settings → Secrets and variables → Actions
2. Add `WEBHOOK_SECRET` as a repository secret
3. The CI will run automatically on push and pull requests

## Next Steps

After deployment:
1. Monitor logs to ensure webhooks are being received
2. Implement webhook event handlers in `webhook/webhook-handler.js`
3. Add tests for webhook processing logic
4. Set up monitoring and alerting
5. Configure webhook events in GitHub App based on your needs
6. Consider adding rate limiting for production

## Architecture

```
GitHub → nginx (443) → webhook-handler (3000)
         ↓
      certbot (SSL)
         ↓
      systemd (process management)
```

- **nginx**: Reverse proxy with SSL termination
- **webhook-handler.js**: Express server that verifies signatures and processes events
- **systemd**: Manages webhook service lifecycle
- **certbot**: Automatic SSL certificate renewal

## License

This project is part of the Createlen ecosystem.