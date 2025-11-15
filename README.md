# Createlen — webhook listener & deployment helpers

Minimal GitHub App webhook listener with deployment automation for Ubuntu/Debian servers.

## Quick Start

### 1. Generate Webhook Secret

```bash
openssl rand -hex 32
```

Save this value - you'll need it for both the server configuration and GitHub App settings.

### 2. Server Deployment

#### Prerequisites
- Ubuntu/Debian server
- Root access
- DNS A record: `createlen.kg-keis.ru` → `94.241.141.3`

#### Deployment Steps

```bash
# Clone repository
git clone https://github.com/vanserokok-arch/Createlen.git
cd Createlen

# Run deployment script (as root)
sudo ./deploy/deploy.sh
```

The script will:
- Install Node.js 20, nginx, certbot
- Create application directories
- Install dependencies
- Set up systemd service
- Configure nginx
- Obtain SSL certificate (if DNS configured)

#### Manual Configuration

After deployment, configure secrets:

```bash
# Copy environment template
sudo cp etc/createlen/.env.example /etc/createlen/.env

# Edit with your values
sudo nano /etc/createlen/.env
```

Set these variables in `/etc/createlen/.env`:
```bash
PORT=3000
WEBHOOK_SECRET=<your-generated-secret-from-step-1>
GH_APP_ID=<your-github-app-id>
GH_PRIVATE_KEY_PATH=/etc/createlen/private-key.pem
GH_INSTALLATION_ID=<your-installation-id>
```

```bash
# Secure the file
sudo chmod 600 /etc/createlen/.env
```

### 3. GitHub App Private Key

Upload your GitHub App private key to the server:

```bash
# On your local machine
scp github-app-private-key.pem user@server:/tmp/

# On server
sudo mv /tmp/github-app-private-key.pem /etc/createlen/private-key.pem
sudo chown www-data:www-data /etc/createlen/private-key.pem
sudo chmod 600 /etc/createlen/private-key.pem
```

### 4. Get GitHub App Installation ID

You can find your installation ID by:

1. Go to your GitHub App settings
2. Click on "Install App"
3. Select the organization/user
4. The installation ID is in the URL: `https://github.com/settings/installations/<INSTALLATION_ID>`

Or via API:
```bash
curl -H "Authorization: Bearer <YOUR_JWT>" \
  https://api.github.com/app/installations
```

### 5. Configure GitHub App Webhook

In your GitHub App settings:

1. Set Webhook URL: `https://createlen.kg-keis.ru/webhook`
2. Set Webhook secret: (paste the secret from step 1)
3. Enable SSL verification
4. Subscribe to events:
   - `push`
   - `pull_request`
   - `installation`
   - `check_run`
   - `check_suite`
   - `workflow_run`
   - `issue_comment`

### 6. Test Webhook

Click "Send test webhook" in GitHub App settings to verify the setup.

Check logs:
```bash
sudo journalctl -u createlen-webhook -f
```

Health check:
```bash
curl -I https://createlen.kg-keis.ru/health
```

## Before Merging Checklist

Before deploying this to production, complete these steps:

- [ ] Generate new webhook secret: `openssl rand -hex 32`
- [ ] Place secret in `/etc/createlen/.env` on server
- [ ] Add webhook secret to GitHub App settings
- [ ] Verify DNS points to server: `dig createlen.kg-keis.ru`
- [ ] Verify HTTPS works: `curl -I https://createlen.kg-keis.ru/health`
- [ ] Run "Send test webhook" in GitHub App settings
- [ ] Verify webhook logs show received events: `sudo journalctl -u createlen-webhook -n 50`
- [ ] Upload GitHub App private key to server
- [ ] Set correct Installation ID in `.env`

## Systemd Commands

```bash
# Start service
sudo systemctl start createlen-webhook

# Stop service
sudo systemctl stop createlen-webhook

# Restart service
sudo systemctl restart createlen-webhook

# View logs
sudo journalctl -u createlen-webhook -f

# Check status
sudo systemctl status createlen-webhook
```

## Nginx Commands

```bash
# Test configuration
sudo nginx -t

# Reload configuration
sudo systemctl reload nginx

# Restart nginx
sudo systemctl restart nginx
```

## Health Checks

```bash
# Local check
curl http://localhost:3000/health

# External check
curl -I https://createlen.kg-keis.ru/health
```

## Troubleshooting

### Webhook not receiving events

1. Check service is running: `sudo systemctl status createlen-webhook`
2. Check logs: `sudo journalctl -u createlen-webhook -n 100`
3. Verify webhook secret matches in both `.env` and GitHub App
4. Test webhook signature verification manually

### SSL Certificate issues

1. Verify DNS: `dig createlen.kg-keis.ru`
2. Check nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. Run certbot manually: `sudo certbot --nginx -d createlen.kg-keis.ru`

### Permission issues

```bash
# Fix ownership
sudo chown -R www-data:www-data /opt/createlen
sudo chown -R root:root /etc/createlen
sudo chmod 750 /etc/createlen
sudo chmod 600 /etc/createlen/.env
sudo chmod 600 /etc/createlen/private-key.pem
```

## Security Notes

- **DO NOT** commit private keys or secrets to the repository
- Store sensitive files with `chmod 600` and owned by appropriate user
- Rotate tokens and secrets periodically
- Enable SSL verification for webhooks
- Use firewall to restrict access if needed

## Development

Run webhook handler locally:

```bash
npm install
export WEBHOOK_SECRET="your-test-secret"
export PORT=3000
npm run webhook
```

## Architecture

```
GitHub → HTTPS → Nginx → Node.js Webhook Handler
                  ↓
              /webhook endpoint (verifies signature)
              /health endpoint
```

