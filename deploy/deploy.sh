#!/usr/bin/env bash
# Idempotent deploy helper for Ubuntu/Debian (run as root)
set -euo pipefail

DOMAIN="createlen.kg-keis.ru"
APP_DIR="/opt/createlen"
ENV_FILE="/etc/createlen/.env"

echo "1) Update and install prerequisites..."
apt update && apt upgrade -y
apt install -y curl gnupg2 ca-certificates lsb-release build-essential

echo "2) Install Node.js 20"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs nginx certbot python3-certbot-nginx

echo "3) Create app directories"
mkdir -p "${APP_DIR}"
chown -R www-data:www-data "${APP_DIR}"
mkdir -p /etc/createlen
chmod 750 /etc/createlen

echo "4) Copy files from repo to deployment locations"
# Uncomment and adjust these lines after cloning the repo:
# cp webhook/webhook-handler.js "${APP_DIR}/"
# cp deploy/createlen-webhook.service /etc/systemd/system/
# cp deploy/nginx.createlen.conf /etc/nginx/sites-available/createlen
# ln -sf /etc/nginx/sites-available/createlen /etc/nginx/sites-enabled/

cd "${APP_DIR}"
if [ ! -f package.json ]; then
  sudo -u www-data npm init -y >/dev/null 2>&1 || true
fi
sudo -u www-data npm install express --no-audit --no-fund

echo "5) Test nginx configuration"
nginx -t && systemctl reload nginx || true

echo "6) Verify DNS before obtaining TLS certificate"
echo "Checking if DNS points to this server..."
if curl -fsS --max-time 5 "http://${DOMAIN}/" >/dev/null 2>&1 || \
   [ "$(dig +short ${DOMAIN} | head -n1)" = "$(curl -s ifconfig.me)" ]; then
  echo "DNS check passed, obtaining certificate..."
  certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "admin@${DOMAIN}" || echo "Certbot failed - check DNS and try again manually"
else
  echo "WARNING: DNS does not point to this server yet. Skipping certbot."
  echo "Run 'certbot --nginx -d ${DOMAIN}' manually after DNS is configured."
fi

echo "7) Enable and start service (ensure /etc/createlen/.env exists with WEBHOOK_SECRET)"
systemctl daemon-reload
systemctl enable --now createlen-webhook || true

echo "Done. Check logs: sudo journalctl -u createlen-webhook -f"
echo "Health check: curl -I https://${DOMAIN}/health"
