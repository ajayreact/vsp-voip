#!/usr/bin/env bash
# Let's Encrypt SSL for vspphone.com production subdomains.
# Run on EC2 as root (Ubuntu/Debian). DNS must point to this server first.
set -euo pipefail

DOMAINS=(
  vspphone.com
  www.vspphone.com
  api.vspphone.com
  app.vspphone.com
  admin.vspphone.com
)

EMAIL="${CERTBOT_EMAIL:-admin@vspphone.com}"

echo "Installing certbot..."
apt-get update
apt-get install -y certbot python3-certbot-nginx

mkdir -p /var/www/certbot

DOMAIN_ARGS=""
for d in "${DOMAINS[@]}"; do
  DOMAIN_ARGS="$DOMAIN_ARGS -d $d"
done

echo "Requesting certificate for: ${DOMAINS[*]}"
certbot certonly --webroot \
  -w /var/www/certbot \
  $DOMAIN_ARGS \
  --email "$EMAIL" \
  --agree-tos \
  --non-interactive

echo ""
echo "Certificate installed. Copy nginx config:"
echo "  sudo cp /opt/vsp-voip/deploy/nginx/vspphone.conf /etc/nginx/sites-available/vspphone.conf"
echo "  sudo ln -sf /etc/nginx/sites-available/vspphone.conf /etc/nginx/sites-enabled/"
echo "  sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "Auto-renewal (cron/systemd timer):"
echo "  certbot renew --dry-run"
