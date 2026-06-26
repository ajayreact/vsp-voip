# VSP Phone — React Native

Expo-based React Native client for the VSP Phone platform.

## Phase 2A — Application shell

Bottom-tab navigation with Dashboard, Calls, Messages, Contacts, and Settings (Profile, Theme, Notifications, About inside Settings stack).

### Prerequisites

- Node.js 20+
- VSP backend running (`npm start` in repo root)
- Expo Go or Android/iOS emulator

### Quick start

```powershell
cd mobile-rn
npm install
copy .env.example .env.local
# Android emulator: EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000
npm start
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Expo dev server |
| `npm run typecheck` | Strict TypeScript check |

### Navigation

```
RootNavigator (protected)
├── Splash → bootstrap auth + settings
├── Offline (no connectivity)
├── SessionExpired
├── Auth → Login
└── MainTabNavigator
    ├── Dashboard → GET /api/dashboard/stats
    ├── Calls → GET /api/calls (read-only history)
    ├── Messages → shell (unread badge from dashboard)
    ├── Contacts → GET /api/tenant/extensions + detail
    └── Settings → Profile, Theme, Notifications, About, Logout
```

### APIs consumed (no new backend endpoints)

| Screen | Endpoint |
|--------|----------|
| Login | `POST /api/auth/login` |
| Session | `GET /api/auth/me` |
| Dashboard | `GET /api/dashboard/stats` |
| Calls | `GET /api/calls?limit=50` |
| Contacts list | `GET /api/tenant/extensions` |
| Contact detail | `GET /api/tenant/extensions/:id` |
| Profile | `GET /api/auth/me`, `GET /api/tenant/profile` |

### Local-only features

- Contact favorites (`AsyncStorage`)
- Theme mode (dark / light / system)
- Notification preferences (stored locally until push phase)

### Libraries

Expo 56 · React Navigation 7 (tabs + native stack) · Zustand · expo-secure-store · NetInfo · AsyncStorage · expo-splash-screen · expo-application

### Next phases

- **Messaging** — conversation list, thread UI, send/MMS via `/api/conversations` and `/api/messages/*`
- **Calling** — Telnyx React Native WebRTC SDK + `POST /api/softphone/token`

See [docs/vsp/pbx/19-mobile-app.md](../docs/vsp/pbx/19-mobile-app.md) for platform context.
