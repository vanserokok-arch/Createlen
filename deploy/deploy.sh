#!/bin/bash
set -e

echo "====================================="
echo "Createlen Webhook Deployment Script"
echo "====================================="
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
  echo "Please run as root or with sudo"
  exit 1
fi

# Variables - CUSTOMIZE THESE
DOMAIN="createlen.kg-keis.ru"
EMAIL="admin@example.com"  # TODO: Replace with your email for Let's Encrypt
APP_DIR="/opt/createlen"
ENV_DIR="/etc/createlen"
SERVICE_NAME="createlen-webhook"

echo "Step 1: Update system and install dependencies..."
apt-get update
apt-get install -y curl gnupg2 ca-certificates lsb-release nginx certbot python3-certbot-nginx

echo ""
echo "Step 2: Install Node.js 20..."
# Install Node.js 20 via NodeSource
if ! command -v node &> /dev/null || [ "$(node -v | cut -d. -f1 | tr -d 'v')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"

echo ""
echo "Step 3: Create directories..."
mkdir -p "$APP_DIR"
mkdir -p "$ENV_DIR"
mkdir -p /var/log/createlen

# Set permissions
chown -R www-data:www-data "$APP_DIR"
chown -R www-data:www-data "$ENV_DIR"
chown -R www-data:www-data /var/log/createlen

echo ""
echo "Step 4: Copy application files..."
# TODO: Clone repository or copy files to $APP_DIR
# Example: git clone https://github.com/vanserokok-arch/Createlen.git "$APP_DIR" || true
# For now, assuming files are already in place
if [ -f "$(dirname "$0")/../webhook/webhook-handler.js" ]; then
  cp -r "$(dirname "$0")/../webhook" "$APP_DIR/"
  echo "Copied webhook files"
fi

echo ""
echo "Step 5: Install Node.js dependencies..."
if [ -f "$APP_DIR/webhook/package.json" ] || [ -f "$APP_DIR/package.json" ]; then
  cd "$APP_DIR"
  sudo -u www-data npm install --production
else
  echo "Note: package.json not found. You'll need to install dependencies manually."
fi

echo ""
echo "Step 6: Copy systemd service file..."
if [ -f "$(dirname "$0")/createlen-webhook.service" ]; then
  cp "$(dirname "$0")/createlen-webhook.service" "/etc/systemd/system/${SERVICE_NAME}.service"
  systemctl daemon-reload
  echo "Systemd service installed"
else
  echo "Warning: systemd service file not found at $(dirname "$0")/createlen-webhook.service"
fi

echo ""
echo "Step 7: Copy nginx configuration..."
if [ -f "$(dirname "$0")/nginx.createlen.conf" ]; then
  cp "$(dirname "$0")/nginx.createlen.conf" "/etc/nginx/sites-available/$DOMAIN"
  
  # Enable site if not already enabled
  if [ ! -L "/etc/nginx/sites-enabled/$DOMAIN" ]; then
    ln -s "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"
  fi
  
  # Test nginx configuration
  nginx -t
  echo "Nginx configuration installed"
else
  echo "Warning: nginx config file not found at $(dirname "$0")/nginx.createlen.conf"
fi

echo ""
echo "Step 8: Set up environment file..."
if [ ! -f "$ENV_DIR/.env" ]; then
  echo "# Createlen Environment Configuration" > "$ENV_DIR/.env"
  echo "PORT=3000" >> "$ENV_DIR/.env"
  echo "WEBHOOK_SECRET=REPLACE_ME_$(openssl rand -hex 16)" >> "$ENV_DIR/.env"
  echo "GH_APP_ID=REPLACE_ME" >> "$ENV_DIR/.env"
  echo "GH_PRIVATE_KEY_PATH=/etc/createlen/private-key.pem" >> "$ENV_DIR/.env"
  echo "GH_INSTALLATION_ID=REPLACE_ME" >> "$ENV_DIR/.env"
  
  chown www-data:www-data "$ENV_DIR/.env"
  chmod 600 "$ENV_DIR/.env"
  
  echo "Created environment file at $ENV_DIR/.env"
  echo "⚠️  IMPORTANT: Edit $ENV_DIR/.env and replace placeholders with actual values!"
else
  echo "Environment file already exists at $ENV_DIR/.env"
fi

echo ""
echo "Step 9: Obtain SSL certificate with certbot..."
echo "⚠️  MANUAL STEP REQUIRED:"
echo "Run the following command to obtain SSL certificate:"
echo "  certbot --nginx -d $DOMAIN --email $EMAIL --agree-tos --non-interactive"
echo ""
echo "Or run interactively:"
echo "  certbot --nginx -d $DOMAIN"

echo ""
echo "Step 10: Enable and start services..."
systemctl enable "$SERVICE_NAME" || echo "Note: Service may not be fully configured yet"
systemctl reload nginx || systemctl restart nginx

echo ""
echo "====================================="
echo "Deployment Complete!"
echo "====================================="
echo ""
echo "Next steps:"
echo "1. Edit $ENV_DIR/.env and add your actual secrets"
echo "2. Obtain SSL certificate (see Step 9 above)"
echo "3. Start the webhook service: systemctl start $SERVICE_NAME"
echo "4. Check service status: systemctl status $SERVICE_NAME"
echo "5. Check logs: journalctl -u $SERVICE_NAME -f"
echo "6. Update GitHub App webhook URL to: https://$DOMAIN/webhook"
echo ""
echo "Health check will be available at: https://$DOMAIN/health"
echo ""
