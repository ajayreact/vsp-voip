# System Architecture

VSP Phone is a multi-tenant cloud PBX built on **Telnyx Call Control** (server-side call orchestration) and the **Telnyx WebRTC JS SDK** (browser/mobile agent media). VSP does not terminate RTP — media flows browser ↔ Telnyx ↔ PSTN/SIP.

---

## System diagram

```mermaid
flowchart TB
  subgraph users [Users]
    Browser[Browser Softphone V2]
    Mobile[Flutter Mobile App]
    PSTN[PSTN Caller]
  end

  subgraph telnyx [Telnyx Cloud]
    CC[Call Control]
    RTC[WebRTC / SIP Gateway]
    STUN[STUN/TURN]
  end

  subgraph vsp [VSP — AWS EC2]
    NGX[Nginx :443]
    WEB[Next.js PM2 :3001]
    API[Express API Docker :3000]
    PG[(PostgreSQL / Prisma)]
    RD[(Redis)]
  end

  Browser -->|HTTPS JWT| NGX --> WEB
  Browser -->|HTTPS REST| NGX --> API
  Browser -->|WSS signaling| RTC
  Browser -->|WebRTC RTP| STUN
  Mobile -->|HTTPS + WebRTC| RTC
  PSTN --> CC
  CC -->|webhooks HTTPS| NGX --> API
  CC --> RTC
  API --> PG
  API --> RD
  API -->|REST| CC
  WEB -.->|login token| API
```

---

## Component roles

| Component | Role | Key paths |
|-----------|------|-----------|
| **Next.js portal** | Tenant UI, Softphone V2, admin | `web/src/app/(app)/` |
| **Express API** | Auth, webhooks, Call Control commands, CDR | `server.js`, `routes/`, `lib/` |
| **PostgreSQL** | Tenants, DIDs, extensions, CDR, VM, recordings | `prisma/schema.prisma` |
| **Redis** | Call Control session state, bridge grace, transfer index | `lib/callControlSessionStore.js` |
| **Nginx** | TLS, reverse proxy to API and web | `deploy/nginx/vspphone.conf` |
| **Docker** | API container | `docker-compose.yml` |
| **PM2** | Next.js production process | `deploy/pm2.ecosystem.config.js` |
| **Telnyx** | PSTN, SIP, WebRTC, recording, voicemail capture | Mission Control + SDK |

---

## Deployment architecture

```mermaid
flowchart LR
  subgraph dns [DNS]
    API_HOST[api.vspphone.com]
    APP_HOST[app.vspphone.com]
  end

  subgraph ec2 [EC2]
    NGX[Nginx]
    DOCKER[Docker Compose]
    PM2[PM2 vsp-web]
  end

  subgraph docker [Docker]
    API[api :3000]
    PG[(postgres)]
    RD[(redis)]
  end

  API_HOST --> NGX --> API
  APP_HOST --> NGX --> PM2
  API --> PG
  API --> RD
```

See [../deployment/02-ec2-deployment.md](../deployment/02-ec2-deployment.md).

---

## Docker services

```mermaid
flowchart TB
  subgraph compose [docker-compose.yml]
    API[api]
    PG[postgres:16]
    RD[redis:7]
  end

  API -->|DATABASE_URL| PG
  API -->|REDIS_URL| RD
  API -->|prisma migrate deploy| PG
```

Entrypoint: `scripts/docker-entrypoint.sh` applies migrations on API start.

---

## Softphone lifecycle (summary)

1. User logs into portal (JWT)
2. `GET /api/softphone/config` — numbers, flags, diagnostics
3. `POST /api/softphone/token` — Telnyx telephony credential JWT
4. `TelnyxRTC` connects (WebSocket to Telnyx)
5. Presence heartbeat → `POST /api/softphone/presence`
6. Inbound: SDK notification → answer with mic → `POST /api/softphone/call-accepted`
7. Outbound: `client.newCall({ destinationNumber, callerNumber })`
8. Hangup / transfer via SDK + API as needed

Detail: [02-call-flow.md](./02-call-flow.md), [03-websocket-lifecycle.md](./03-websocket-lifecycle.md), [04-webrtc-media.md](./04-webrtc-media.md)

---

## Call orchestration split

| Concern | Where it runs |
|---------|---------------|
| DID → tenant routing | VSP API (`lib/inboundCallControl.js`) |
| Ring / bridge / VM / IVR | VSP API + Telnyx Call Control REST |
| Agent media (mic/speaker) | Browser ↔ Telnyx WebRTC |
| Blind transfer | VSP API + Call Control `transfer` on PSTN leg |
| CDR / history | VSP API → Prisma `CallLog` |

---

## Protected components

Changes to telephony core require regression analysis:

- `lib/inboundCallControl.js`
- `lib/telnyxCallControl.js`
- `lib/callControlSessionStore.js`
- `web/src/lib/webrtc-audio.ts`
- `web/src/lib/telnyx-softphone-session.ts`
- `web/src/app/(app)/softphone-v2/page.tsx`

---

## Related docs

- [02-call-flow.md](./02-call-flow.md)
- [05-call-control.md](./05-call-control.md)
- [06-session-management.md](./06-session-management.md)
- [../architecture-decisions/](../architecture-decisions/)
- [../../telnyx/architecture.md](../../telnyx/architecture.md)
