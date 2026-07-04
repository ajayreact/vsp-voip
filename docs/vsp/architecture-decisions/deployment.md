# ADR: Deployment Architecture

## Problem

VSP Phone needs production hosting with HTTPS for webhooks, Web portal, and API without managed Kubernetes complexity for early customers.

## Decision

Single **EC2** instance:

- **Docker Compose:** API + PostgreSQL + Redis
- **PM2:** Next.js portal on port 3001
- **Nginx:** TLS termination, subdomain routing
- Telnyx webhooks → `https://api.vspphone.com`

Deploy scripts: `deploy/deploy-api.sh`, `deploy/deploy-web.sh`.

## Reason

Minimal ops surface for pilot (~10 tenants). Matches current team capacity. Media still on Telnyx — EC2 handles signaling only.

## Alternatives

| Alternative | Rejected because |
|-------------|------------------|
| ECS Fargate (documented in launch guide) | Not yet deployed |
| Vercel + serverless API | Webhook + Redis session needs long-running process |
| Multi-instance behind ALB | Premature — needs Redis hard requirement first |

## Trade-offs

| Pro | Con |
|-----|-----|
| Simple deploy | Single point of failure |
| Low cost | Manual scaling |
| Full shell access for debug | Ops discipline required |

## Future impact

- Migrate to RDS/ElastiCache/ECS per launch guide
- Until then: deployment mismatches are leading cause of "broken calls" — verify before code changes

**Related:** [../deployment/02-ec2-deployment.md](../deployment/02-ec2-deployment.md), [.cursor/rules/deployment-safety.mdc](../../../.cursor/rules/deployment-safety.mdc)
