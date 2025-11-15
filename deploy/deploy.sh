#!/bin/bash
set -e

# Idempotent deployment script for Createlen webhook listener
# For Ubuntu/Debian systems
# Requires: sudo privileges

DOMAIN="createlen.kg-keis.ru"
APP_DIR="/opt/createlen"
CONFIG_DIR="/etc/createlen"
SERVICE_NAME="createlen-webhook"
WEBHOOK_USER="www-data"

echo "=== Createlen Webhook Deployment Script ==="
echo ""

# Check if running with sudo
if [ "$EUID" -ne 0 ]; then 
  echo "ERROR: Please run this script with sudo"
  exit 1
fi

echo "[1/8] Updating package lists..."
apt-get update

echo "[2/8] Installing Node.js 20..."
if ! command -v node &> /dev/null || [ "$(node -v | cut -d. -f1 | sed 's/v//')" -lt 20 ]; then
  # Install Node.js 20.x using NodeSource repository
  if [ ! -f /etc/apt/sources.list.d/nodesource.list ]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  fi
  apt-get install -y nodejs
  echo "Node.js $(node -v) installed"
else
  echo "Node.js $(node -v) already installed"
fi

echo "[3/8] Installing nginx and certbot..."
apt-get install -y nginx certbot python3-certbot-nginx

echo "[4/8] Creating application directories..."
mkdir -p "$APP_DIR"
mkdir -p "$CONFIG_DIR"
chown -R "$WEBHOOK_USER:$WEBHOOK_USER" "$APP_DIR"
chmod 755 "$APP_DIR"
chmod 755 "$CONFIG_DIR"

echo "[5/8] Copying application files..."
# MANUAL ACTION REQUIRED: Copy your repository files to $APP_DIR
if [ ! -f "$APP_DIR/webhook/webhook-handler.js" ]; then
  echo "WARNING: Application files not found in $APP_DIR"
  echo "Please copy the repository contents to $APP_DIR:"
  echo "  sudo rsync -av /path/to/your/repo/ $APP_DIR/ --exclude .git --exclude node_modules"
fi

echo "[6/8] Installing npm dependencies..."
if [ -f "$APP_DIR/package.json" ]; then
  cd "$APP_DIR"
  sudo -u "$WEBHOOK_USER" npm install --production
  echo "Dependencies installed"
else
  echo "WARNING: package.json not found, skipping npm install"
fi

echo "[7/8] Setting up systemd service..."
# Copy systemd service file
if [ -f "$APP_DIR/deploy/createlen-webhook.service" ]; then
  cp "$APP_DIR/deploy/createlen-webhook.service" /etc/systemd/system/
  systemctl daemon-reload
  echo "Systemd service installed"
  
  # MANUAL ACTION REQUIRED: Configure environment variables
  if [ ! -f "$CONFIG_DIR/.env" ]; then
    echo "WARNING: $CONFIG_DIR/.env not found"
    echo "Please create $CONFIG_DIR/.env with required variables:"
    echo "  PORT=3000"
    echo "  WEBHOOK_SECRET=<your-webhook-secret>"
    echo "  GH_APP_ID=<your-app-id>"
    echo "  GH_PRIVATE_KEY_PATH=$CONFIG_DIR/private-key.pem"
    echo "  GH_INSTALLATION_ID=<your-installation-id>"
    echo ""
    echo "Generate webhook secret: openssl rand -hex 32"
  fi
else
  echo "WARNING: createlen-webhook.service not found in $APP_DIR/deploy/"
fi

echo "[8/8] Setting up nginx..."
if [ -f "$APP_DIR/deploy/nginx.createlen.conf" ]; then
  cp "$APP_DIR/deploy/nginx.createlen.conf" /etc/nginx/sites-available/createlen
  ln -sf /etc/nginx/sites-available/createlen /etc/nginx/sites-enabled/createlen
  
  # Test nginx configuration
  nginx -t
  echo "Nginx configuration installed"
else
  echo "WARNING: nginx.createlen.conf not found in $APP_DIR/deploy/"
fi

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "MANUAL STEPS REQUIRED:"
echo ""
echo "1. Configure environment variables in $CONFIG_DIR/.env"
echo "   Generate webhook secret: openssl rand -hex 32"
echo ""
echo "2. Add GitHub App private key to $CONFIG_DIR/private-key.pem"
echo "   Ensure it's owned by $WEBHOOK_USER and has mode 600"
echo ""
echo "3. Obtain SSL certificate with certbot:"
echo "   sudo certbot --nginx -d $DOMAIN"
echo ""
echo "4. Update GitHub App webhook URL to: https://$DOMAIN/webhook"
echo ""
echo "5. Enable and start the service:"
echo "   sudo systemctl enable $SERVICE_NAME"
echo "   sudo systemctl start $SERVICE_NAME"
echo ""
echo "6. Reload nginx:"
echo "   sudo systemctl reload nginx"
echo ""
echo "Check service status: sudo systemctl status $SERVICE_NAME"
echo "View logs: sudo journalctl -u $SERVICE_NAME -f"
echo ""
