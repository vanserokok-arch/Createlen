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

echo "4) Expect webhook-handler.js to be placed in ${APP_DIR} (copy from repo)"
# If not present: you can scp it manually or clone the repo to /opt/createlen

cd "${APP_DIR}"
if [ ! -f package.json ]; then
  sudo -u www-data npm init -y >/dev/null 2>&1 || true
fi
sudo -u www-data npm install express --no-audit --no-fund

echo "5) Install systemd unit and nginx config (placeholders - copy from repo)"
# Copy deploy/createlen-webhook.service to /etc/systemd/system/createlen-webhook.service
# Copy deploy/nginx.createlen.conf to /etc/nginx/sites-available/createlen and symlink to sites-enabled

echo "6) Test nginx and reload"
nginx -t && systemctl reload nginx || true

echo "7) Obtain TLS certificate (ensure DNS points to this server)"
certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m admin@${DOMAIN} || true

echo "8) Enable and start service (ensure /etc/createlen/.env exists with WEBHOOK_SECRET)"
systemctl daemon-reload
systemctl enable --now createlen-webhook || true

echo "Done. Check logs: sudo journalctl -u createlen-webhook -f"
