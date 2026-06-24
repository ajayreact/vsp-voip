# Admin Telephony Health Dashboard

**Route:** `/admin/monitoring/telephony-health`  
**API:** `GET /api/admin/telephony-health`  
**Access:** `SUPER_ADMIN` only  
**Mode:** Read-only operations monitoring

---

## Dashboard Layout

The dashboard is grouped into operational sections:

1. **Registrations**
   - Active Registrations
   - Failed Registrations
   - Reconnect Count

2. **Calls**
   - Calls Started
   - Calls Connected
   - Calls Failed
   - Calls Ended

3. **Presence**
   - Online Users
   - Offline Users

4. **Voicemail**
   - Unread Voicemails
   - Total Voicemails

5. **Recordings**
   - Total Recordings

6. **Call Control Health**
   - Active Sessions
   - Winner Claims
   - Race Condition Prevented Count

7. **Telemetry Feed**
   - Last 100 observed events in the current API process

The page also displays the database queries used, API endpoints used, and deployment notes.

---

## Database Queries Used

The backend endpoint aggregates:

```text
User.count where tenantId != null and (softphoneOnlineAt >= now - 5m OR sipRegistered = true)
User.count where sipRegistrationResponse != null and sipRegistered = false
CallLog.count by status over last 24h
User.count where softphoneOnlineAt >= now - 5m
Voicemail.count total and unread
CallRecording.count total
CallControlSessionStore active session and winner claim counters
In-memory Softphone telemetry feed last 100 events
```

Primary Prisma models:

- `User`
- `CallLog`
- `Voicemail`
- `CallRecording`

Call Control live state comes from `lib/callControlSessionStore.js`:

- Redis keys when `REDIS_URL` is configured
- In-memory fallback in local development

Telemetry feed and race-prevented counts come from `lib/telephonyHealth.js`.

---

## API Endpoints Used

Dashboard API:

```text
GET /api/admin/telephony-health
```

Observed/source APIs:

```text
POST /api/softphone/telemetry
POST /api/softphone/presence
POST /api/softphone/call-log
GET /api/tenant/voicemails
GET /api/tenant/recordings
```

---

## Implementation Notes

- No Softphone V2 runtime behavior was changed.
- `POST /api/softphone/telemetry` now records a process-local copy of the last 100 events for admin visibility.
- Call Control race guards increment a process-local race-prevented counter.
- `GET /api/admin/telephony-health` is protected by existing admin middleware and `SUPER_ADMIN` role enforcement.
- The dashboard is linked under **Admin → Monitoring → Telephony health**.

---

## Deployment Notes

1. Deploy API and web together so the new admin page and endpoint are available at the same time.
2. Set `REDIS_URL` before horizontally scaling API instances. Without Redis, active sessions and winner claims are local to a single process.
3. Telemetry feed and race-prevented count are process-local in this release. For multi-instance durable history, back these with Redis or a database table later.
4. Monitor:
   - Reconnect Count
   - Calls Failed
   - Race Condition Prevented Count
   - Failed Registrations
   - Voicemail / recording stream errors

---

## Regression Scope

This dashboard is read-only. It does not modify:

- Telnyx registration
- JWT flow
- Call Control routing decisions
- Presence heartbeat behavior
- Call logging behavior
- Reconnect logic
- DTMF
- Voicemail APIs
- Recording APIs
