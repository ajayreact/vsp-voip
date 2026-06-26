# Nginx

Nginx on EC2 terminates TLS and routes subdomains to the API (Docker :3000) and Next.js portal (PM2 :3001).

Config: [deploy/nginx/vspphone.conf](../../../deploy/nginx/vspphone.conf)  
SSL setup: [deploy/ssl-setup.sh](../../../deploy/ssl-setup.sh)

---

## Host routing

| Hostname | Upstream | Content |
|----------|----------|---------|
| `vspphone.com` | Static files | `/opt/vsp-voip/landing/` |
| `www.vspphone.com` | Redirect | → `https://vspphone.com` |
| `api.vspphone.com` | `127.0.0.1:3000` | Express API |
| `app.vspphone.com` | `127.0.0.1:3001` | Tenant portal |
| `admin.vspphone.com` | `127.0.0.1:3001` | Super admin portal |

---

## Install / update config

```bash
sudo cp /opt/vsp-voip/deploy/nginx/vspphone.conf /etc/nginx/sites-available/vspphone.conf
sudo ln -sf /etc/nginx/sites-available/vspphone.conf /etc/nginx/sites-enabled/vspphone.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

---

## WebSocket support

The config defines `$connection_upgrade` and sets:

```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection $connection_upgrade;
```

Used on API and app/admin blocks for WebSocket upgrades.

**Note:** Telnyx WebRTC media does not traverse Nginx — browser connects directly to Telnyx. Nginx WebSockets matter for Next.js and any API WS endpoints.

---

## Authorization header

JWT Bearer tokens must reach the API:

```nginx
proxy_set_header Authorization $http_authorization;
```

If mobile or web auth returns 401 for valid tokens, verify this header is present (Nginx proxy mismatch — see [11-known-issues.md](./11-known-issues.md)).

---

## Telnyx webhooks

`/webhook` on `api.vspphone.com` has **no rate limit** (burst traffic during calls):

```
https://api.vspphone.com/webhook/call-control
```

Other API routes use `limit_req` (30 req/s, burst 60).

---

## SSL / Let's Encrypt

Certificates: `/etc/letsencrypt/live/vspphone.com/`

Renewal (certbot typically via cron):

```bash
sudo certbot renew --dry-run
```

Initial setup:

```bash
sudo bash /opt/vsp-voip/deploy/ssl-setup.sh
```

DNS must resolve all subdomains to the EC2 IP before cert issuance.

---

## Logs

```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

Filter by host:

```bash
sudo grep 'api.vspphone.com' /var/log/nginx/access.log | tail -20
```

---

## Troubleshooting

| Symptom | Check |
|---------|-------|
| 502 Bad Gateway | API/PM2 down: `curl 127.0.0.1:3000/health`, `pm2 status` |
| 403 on landing | Run `sudo bash deploy/setup-landing.sh` |
| Webhooks fail | TLS cert valid, `/webhook` reachable from Telnyx |
| CORS errors | Usually API `WEB_ORIGIN` — not Nginx |
| Wrong app version | Stale PM2 or browser cache — not Nginx |

Test config before reload:

```bash
sudo nginx -t
```

---

## Related docs

- [02-ec2-deployment.md](./02-ec2-deployment.md)
- [12-disaster-recovery.md](./12-disaster-recovery.md)
- [13-monitoring.md](./13-monitoring.md)
