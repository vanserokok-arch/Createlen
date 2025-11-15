#!/bin/bash
set -e

# Idempotent deployment script for Createlen webhook listener on Ubuntu/Debian
# This script installs dependencies, configures nginx and systemd, and obtains SSL certificates

echo "=== Createlen Webhook Deployment Script ==="
echo "Starting deployment on $(date)"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "ERROR: This script must be run as root (use sudo)"
  exit 1
fi

# Variables
DOMAIN="createlen.kg-keis.ru"
APP_DIR="/opt/createlen"
CONFIG_DIR="/etc/createlen"
SERVICE_NAME="createlen-webhook"
NGINX_CONFIG="/etc/nginx/sites-available/createlen.conf"
NGINX_ENABLED="/etc/nginx/sites-enabled/createlen.conf"

echo ""
echo "Step 1: Installing Node.js 20..."
if ! command -v node &> /dev/null || [ "$(node -v | cut -d. -f1 | sed 's/v//')" -lt 20 ]; then
  echo "Installing Node.js 20 via NodeSource..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
else
  echo "Node.js 20+ is already installed: $(node -v)"
fi

echo ""
echo "Step 2: Installing nginx..."
if ! command -v nginx &> /dev/null; then
  apt-get update
  apt-get install -y nginx
else
  echo "nginx is already installed: $(nginx -v 2>&1)"
fi

echo ""
echo "Step 3: Installing certbot..."
if ! command -v certbot &> /dev/null; then
  apt-get install -y certbot python3-certbot-nginx
else
  echo "certbot is already installed: $(certbot --version 2>&1 | head -n1)"
fi

echo ""
echo "Step 4: Creating directories..."
mkdir -p "$APP_DIR"
mkdir -p "$CONFIG_DIR"
chown -R www-data:www-data "$APP_DIR"
chown -R www-data:www-data "$CONFIG_DIR"
echo "Directories created: $APP_DIR, $CONFIG_DIR"

echo ""
echo "Step 5: Copying application files..."
# MANUAL STEP: Copy your repository files to $APP_DIR
# Example: git clone https://github.com/vanserokok-arch/Createlen.git "$APP_DIR"
# OR: rsync -av /path/to/local/repo/ "$APP_DIR/"
if [ ! -f "$APP_DIR/package.json" ]; then
  echo "WARNING: No package.json found in $APP_DIR"
  echo "MANUAL ACTION REQUIRED: Copy application files to $APP_DIR before continuing"
  echo "Example: git clone <repo-url> $APP_DIR"
  echo "Press Enter after copying files to continue..."
  read -r
fi

echo ""
echo "Step 6: Installing npm dependencies..."
if [ -f "$APP_DIR/package.json" ]; then
  cd "$APP_DIR"
  sudo -u www-data npm install --production
  echo "npm dependencies installed"
else
  echo "WARNING: Skipping npm install - no package.json found"
fi

echo ""
echo "Step 7: Setting up environment file..."
if [ ! -f "$CONFIG_DIR/.env" ]; then
  echo "WARNING: $CONFIG_DIR/.env does not exist"
  echo "MANUAL ACTION REQUIRED: Create $CONFIG_DIR/.env with required variables"
  echo "You can copy from etc/createlen/.env.example in the repository"
  echo "Required variables: PORT, WEBHOOK_SECRET, GH_APP_ID, GH_PRIVATE_KEY_PATH, GH_INSTALLATION_ID"
  echo "Press Enter after creating .env file to continue..."
  read -r
fi

# Set proper permissions for .env
if [ -f "$CONFIG_DIR/.env" ]; then
  chown www-data:www-data "$CONFIG_DIR/.env"
  chmod 600 "$CONFIG_DIR/.env"
  echo "Environment file permissions set"
fi

echo ""
echo "Step 8: Installing systemd service..."
if [ -f "$APP_DIR/deploy/createlen-webhook.service" ]; then
  cp "$APP_DIR/deploy/createlen-webhook.service" /etc/systemd/system/
  systemctl daemon-reload
  echo "Systemd service installed"
else
  echo "WARNING: deploy/createlen-webhook.service not found in $APP_DIR"
fi

echo ""
echo "Step 9: Installing nginx configuration..."
if [ -f "$APP_DIR/deploy/nginx.createlen.conf" ]; then
  cp "$APP_DIR/deploy/nginx.createlen.conf" "$NGINX_CONFIG"
  
  # Enable site if not already enabled
  if [ ! -L "$NGINX_ENABLED" ]; then
    ln -s "$NGINX_CONFIG" "$NGINX_ENABLED"
    echo "nginx site enabled"
  else
    echo "nginx site already enabled"
  fi
  
  # Test nginx configuration
  nginx -t
  echo "nginx configuration is valid"
else
  echo "WARNING: deploy/nginx.createlen.conf not found in $APP_DIR"
fi

echo ""
echo "Step 10: Obtaining SSL certificate with certbot..."
echo "MANUAL ACTION REQUIRED: Run the following command to obtain SSL certificate:"
echo "  certbot --nginx -d $DOMAIN"
echo ""
echo "This will:"
echo "  1. Verify domain ownership"
echo "  2. Obtain SSL certificate from Let's Encrypt"
echo "  3. Automatically configure nginx for HTTPS"
echo ""
echo "Press Enter after running certbot to continue..."
read -r

echo ""
echo "Step 11: Starting and enabling service..."
if systemctl list-unit-files | grep -q "$SERVICE_NAME.service"; then
  systemctl enable "$SERVICE_NAME"
  systemctl restart "$SERVICE_NAME"
  echo "Service $SERVICE_NAME started and enabled"
  
  # Show service status
  systemctl status "$SERVICE_NAME" --no-pager || true
else
  echo "WARNING: Service file not found, skipping service start"
fi

echo ""
echo "Step 12: Reloading nginx..."
systemctl reload nginx
echo "nginx reloaded"

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Next steps:"
echo "1. Verify service is running: systemctl status $SERVICE_NAME"
echo "2. Check logs: journalctl -u $SERVICE_NAME -f"
echo "3. Test health endpoint: curl http://localhost:3000/health"
echo "4. Test webhook endpoint: curl -X POST http://localhost:3000/webhook"
echo "5. Update GitHub App webhook URL to: https://$DOMAIN/webhook"
echo "6. Configure webhook secret in GitHub App settings (should match WEBHOOK_SECRET in .env)"
echo ""
echo "Deployment log completed on $(date)"
