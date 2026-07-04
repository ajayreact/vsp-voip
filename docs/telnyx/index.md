# VSP Phone — Telnyx Knowledge Base

Local, searchable Telnyx documentation curated for the VSP Phone stack. Cursor and developers should search here **before** fetching external Telnyx docs.

## Quick links

| Area | Path |
|------|------|
| Overview | [overview.md](./overview.md) |
| VSP + Telnyx architecture | [architecture.md](./architecture.md) |
| Search index (JSON) | [search-index.json](./search-index.json) |
| Validation report | [VALIDATION-REPORT.md](./VALIDATION-REPORT.md) |
| JavaScript WebRTC SDK | [javascript-sdk/](./javascript-sdk/) |
| WebRTC concepts (ICE/TURN/auth) | [webrtc/](./webrtc/) |
| Call Control / Voice API | [call-control/](./call-control/) |
| Phone numbers | [phone-numbers/](./phone-numbers/) |
| SIP / credentials | [sip/](./sip/) |
| Recordings | [recordings/](./recordings/) |
| Voicemail | [voicemail/](./voicemail/) |
| Conferences | [conferences/](./conferences/) |
| Transfers | [transfers/](./transfers/) |
| Messaging (future) | [messaging/](./messaging/) |
| Webhooks | [webhooks/](./webhooks/) |
| Authentication | [authentication/](./authentication/) |
| Error codes / troubleshooting | [error-codes/](./error-codes/) |
| Best practices | [best-practices/](./best-practices/) |
| Changelog / release notes | [changelog/](./changelog/) |

## Refresh

```bash
node scripts/update-telnyx-docs.js
# or on Linux/EC2:
bash scripts/update-telnyx-docs
```

Options:

- `--dry-run` — discover and diff without writing files
- `--verbose` — log skipped pages

## Search order for Cursor

1. **This knowledge base** — `docs/telnyx/**`
2. **VSP source code** — `web/`, `lib/`, `routes/`, etc.
3. **Official Telnyx docs** — only when local KB is missing info or verifying recent API changes

## What is included

Documentation for technologies VSP Phone uses:

- Node.js / Express / TypeScript backend
- React / Next.js frontend
- Telnyx **JavaScript WebRTC SDK** (`@telnyx/webrtc`)
- Telnyx **Call Control API**
- SIP credential connections, telephony credentials, JWT
- WebRTC media (RTP, ICE, STUN, TURN)
- Phone numbers, recordings, voicemail, transfers, bridge, conferences
- Flutter SDK (future mobile)

## What is excluded

Python, PHP, Ruby, Java, .NET, native iOS/Android SDKs, React Native, TeXML, IoT, wireless, AI inference, and other stacks not used by VSP Phone. See `.telnyx-docs-config.json` for the full exclusion list.

## Index metadata

Each synced page is recorded in `search-index.json` with:

- Title, summary, keywords
- Category and local path
- Related APIs, SDK classes, events, webhooks
- Source URL and content hash
