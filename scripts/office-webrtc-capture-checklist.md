# Office WebRTC One-Way Audio — Evidence Capture

Use this checklist during an **active call** from the office network.

## Deploy (EC2)

```bash
cd /opt/vsp-voip
git pull origin main   # or your feature branch after merge
bash deploy/deploy-web.sh
```

Confirm route: https://app.vspphone.com/softphone-v2/diagnostics

## Reproduce

1. Open **Softphone V2** on the office PC/browser.
2. Place or answer a call where one-way audio occurs.
3. **Without hanging up**, open a new tab: `/softphone-v2/diagnostics`
   - Or: Softphone V2 → **More** → **WebRTC Diagnostics**
4. Wait 5–10 seconds for metrics to populate.
5. Click **Export JSON** and save the file.
6. Screenshot the on-screen **ICE states**, **candidate counts**, **RTP**, and **alerts**.

## Record in ticket

| Field | Value from diagnostics |
|-------|------------------------|
| ICE Connection State | |
| ICE Gathering State | |
| Connection State | |
| Selected pair — local type | host / srflx / relay |
| Selected pair — remote type | |
| host / srflx / relay counts | |
| outbound packetsSent | |
| inbound packetsReceived | |
| Smart alerts (full text) | |
| Public IP (srflx) | |
| VPN suspected | |
| Exported JSON filename | |

## Interpretation guide

| Evidence | Likely cause |
|----------|----------------|
| ICE `failed` + failure hints | Firewall / TURN blocked |
| Only `relay` candidates, alert about corporate network | TURN relay path (expected in strict offices) |
| `connected` but outbound packetsSent = 0 | Mic blocked or outbound RTP blocked |
| `connected` but inbound packetsReceived = 0 | Inbound RTP blocked or remote audio |
| `host` selected at office but one-way audio | Symmetric NAT / wrong candidate |
| Works at home, relay at office | Office firewall (not deployment regression) |

Attach exported JSON to the ticket for engineering review.
