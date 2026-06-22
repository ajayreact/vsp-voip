# Production Deployment Guide

Target: **first 10 paying customers** on AWS with HTTPS, managed Postgres, Redis, and secrets management.

---

## Architecture (10 customers)

```mermaid
flowchart TB
  subgraph users [Users]
    Browser[Web Portal]
    Mobile[Mobile App]
    Telnyx[Telnyx Cloud]
  end

  subgraph aws [AWS]
    R53[Route 53]
    CF[CloudFront - optional]
    ALB[Application Load Balancer]
    ACM[ACM TLS Certificate]

    subgraph compute [Compute]
      API[ECS Fargate - API x1-2]
      WEB[Amplify or ECS - Next.js]
    end

    RDS[(RDS PostgreSQL 16)]
    Redis[(ElastiCache Redis 7)]
    SM[Secrets Manager]
    CW[CloudWatch Logs]
  end

  Browser --> CF --> WEB
  Browser --> ALB
  Mobile --> ALB
  Telnyx --> ALB
  ALB --> ACM
  ALB --> API
  API --> RDS
  API --> Redis
  API --> SM
  API --> CW
  R53 --> ALB
  R53 --> CF
```

---

## Domains & URLs

| Variable | Example | Purpose |
|----------|---------|---------|
| `API_PUBLIC_URL` | `https://api.vsp-voip.com` | Telnyx webhooks |
| `WEB_ORIGIN` | `https://app.vsp-voip.com` | Portal, Stripe redirects, emails |
| `NEXT_PUBLIC_API_URL` | `https://api.vsp-voip.com` | Web app API calls |

---

## 1. PostgreSQL (RDS)

| Setting | First 10 customers |
|---------|-------------------|
| Engine | PostgreSQL 16 |
| Instance | `db.t4g.micro` or `db.t4g.small` |
| Storage | 20 GB gp3, autoscaling enabled |
| Multi-AZ | Optional (recommended before 100) |
| Backups | 7-day retention, daily snapshot |
| SSL | Require `sslmode=require` in `DATABASE_URL` |

**Connection string:**

```env
DATABASE_URL=postgresql://vsp_app:SECRET@your-rds-endpoint:5432/vsp_voip?sslmode=require
```

**Post-deploy:**

```bash
npx prisma migrate deploy
npm run seed   # super admin only — once per environment
```

---

## 2. Redis (ElastiCache)

| Setting | First 10 customers |
|---------|-------------------|
| Engine | Redis 7.x |
| Node | `cache.t4g.micro` |
| TLS | Enable in-transit encryption |
| Auth | AUTH token required |

```env
REDIS_URL=rediss://:AUTH_TOKEN@your-redis-endpoint:6379
```

Used for: tenant cache, Call Control sessions, rate limits, greeting dedup, password reset tokens.

Verify: `GET https://api.vsp-voip.com/ready` → `"redis": { "connected": true }`

See also: [../redis-deployment.md](../redis-deployment.md)

---

## 3. API deployment (ECS Fargate)

### Container

Use repo `Dockerfile`:

```bash
docker build -t vsp-voip-api .
```

### Task definition (minimum)

| Resource | Value |
|----------|-------|
| CPU | 512 (0.5 vCPU) |
| Memory | 1024 MB |
| Port | 3000 |
| Health check | `GET /ready` |

### Environment variables

Store in **AWS Secrets Manager** and inject at task start. Required in production (`lib/env.js`):

```
DATABASE_URL
REDIS_URL
JWT_SECRET
SETTINGS_ENCRYPTION_KEY
TELNYX_API_KEY
TELNYX_PUBLIC_KEY
STRIPE_WEBHOOK_SECRET
SMTP_HOST
SMTP_FROM
API_PUBLIC_URL
WEB_ORIGIN
NODE_ENV=production
PORT=3000
```

Optional: `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SUPPORT_EMAIL`, `STRIPE_SECRET_KEY` (or configure in platform settings).

### ALB target group

- Health check path: `/ready`
- Healthy threshold: 2
- Unhealthy threshold: 3
- Interval: 30s

---

## 4. Web deployment (Next.js)

**Option A — AWS Amplify Hosting (recommended for speed)**

1. Connect GitHub repo, set app root to `web/`
2. Build: `npm run build`
3. Env: `NEXT_PUBLIC_API_URL=https://api.vsp-voip.com`

**Option B — ECS** behind same or separate ALB on `app.` subdomain.

---

## 5. HTTPS configuration

1. Request ACM certificate for `api.vsp-voip.com` and `app.vsp-voip.com` (DNS validation)
2. Attach certificate to ALB HTTPS listener (443)
3. Redirect HTTP → HTTPS
4. Set security group: 443 from `0.0.0.0/0`, 3000 internal only

**Telnyx requires publicly reachable HTTPS webhooks** — no self-signed certs.

---

## 6. Secrets management

| Secret | Rotation |
|--------|----------|
| `JWT_SECRET` | On compromise; forces re-login |
| `SETTINGS_ENCRYPTION_KEY` | Never rotate without migration plan |
| `DATABASE_URL` | With RDS password rotation |
| `STRIPE_WEBHOOK_SECRET` | When Stripe endpoint recreated |
| `TELNYX_API_KEY` | Quarterly |

Use IAM task role — no secrets in Docker image or git.

---

## 7. Deploy sequence

```text
1. Provision RDS + ElastiCache + Secrets Manager
2. Run prisma migrate deploy against RDS
3. Seed super admin (one time)
4. Deploy API → verify /ready
5. Deploy web → verify login
6. Configure Telnyx webhooks (see telnyx-go-live-guide.md)
7. Configure Stripe webhooks (see stripe-go-live-guide.md)
8. Send test email (see smtp-setup-guide.md)
9. Run npm run validate:p0 against production URL
10. Onboard pilot customer (see customer-onboarding-sop.md)
```

---

## 8. Scaling path

| Customers | API | RDS | Redis |
|-----------|-----|-----|-------|
| 10 | 1× Fargate 0.5 vCPU | db.t4g.micro | cache.t4g.micro |
| 100 | 2× Fargate 1 vCPU + autoscale | db.t4g.small Multi-AZ | cache.t4g.small |
| 1000 | 4–8× Fargate + ALB | db.r6g.large + replica | cache.r6g.large |

---

## 9. Monitoring

- CloudWatch Logs: API stdout (JSON structured logs)
- UptimeRobot / Pingdom: `GET /ready` every 5 min
- CloudWatch alarm: RDS CPU > 80%, ElastiCache evictions
- Optional: Sentry for error tracking

---

## 10. Local production-like stack

```bash
docker compose -f docker-compose.yml up -d
# Set .env for local services, then:
npx prisma migrate deploy
npm start
```

For staging, use separate RDS/ElastiCache instances — never share production database.
