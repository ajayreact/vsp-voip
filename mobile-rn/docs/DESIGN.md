# VSP Phone — Mobile UI & UX Design

Enterprise mobile design system for the React Native app. **Not** modeled on WhatsApp, iPhone Phone, Google Phone, Teams, or Zoom.

---

## 1. Design system usage

### Brand alignment (web parity)

Tokens mirror the web portal (`web/src/app/globals.css`):

| Token | Web | Mobile (`src/shared/theme/`) |
|-------|-----|------------------------------|
| Accent | `#6366f1` | `colors.primary` |
| Accent hover | `#4f46e5` | `colors.primaryHover` |
| Hero gradient | `hero-banner` 135deg indigo→violet | `VspHero` + `LinearGradient` |
| Surface card | `panel-card` | `VspPanel` |
| Background | `#f4f6f8` / slate dark | `colors.background` |
| Muted text | `#64748b` | `colors.textMuted` |

### Typography

- **Display** — call timers, dial display (`typography.mono`)
- **Title** — screen headers (`typography.title`, negative letter-spacing like web `page-title`)
- **Section** — uppercase labels (`typography.section`)
- **Body / Caption** — content hierarchy

### Spacing & touch

- Minimum touch target: **48dp** (`tokens.touchTarget`)
- Dial keys: **72dp** rounded squares (`VspDialKey`) — not circular iPhone keys
- Card radius: **14px** (`tokens.radius.lg`) matching web `0.875rem`

### VSP components (`src/components/vsp/`)

| Component | Purpose |
|-----------|---------|
| `VspHero` | Indigo gradient header banners |
| `VspPanel` | Elevated content panels |
| `VspSegmentedControl` | Enterprise segments (Recent / Dial pad) |
| `VspDialPad` / `VspDialDisplay` | Square-grid dialer |
| `VspCallRow` / `VspVoicemailRow` | Activity lists with badges |
| `VspConversationRow` | Left-accent conversation cards (not chat bubbles) |
| `VspMessageBlock` | Flat directional message blocks |
| `VspIconButton` / `VspActionBar` | Call control strip |
| `VspBadge` / `VspChip` | Status and filters |

### Visual differentiation

- **Calls:** Headset tab icon, segmented hub, horizontal action bar — not green/red iPhone circles
- **Messages:** Card rows with indigo accent bar — not bubble threads
- **Voicemail:** Purple accent (`colors.voicemail`), play-tile rows — dedicated tab, not buried in Phone app recents

---

## 2. Navigation map

```
Root (auth-gated)
├── Splash / Offline / Session expired
├── Auth → Login
└── MainTabNavigator (6 tabs)
    ├── Dashboard → DashboardHome
    ├── Calls → CallsHub [Recent | Dial pad]
    │              ├── ActiveCallPreview (modal)
    │              └── IncomingCallPreview (fullscreen modal)
    ├── Messages → ConversationList
    │              ├── ConversationThread
    │              ├── NewMessage
    │              └── Attachments
    ├── Contacts → ContactsList → ContactDetail
    ├── Voicemail → VoicemailList → VoicemailDetail
    └── Settings → Profile, Theme, Notifications, About
```

Tab icons use **business metaphors** (analytics, headset, mail, id-card, recording, options) — not consumer phone/messaging clones.

---

## 3. Screen flows

### Authentication
`Splash → Login → Dashboard` (JWT persisted)

### Calling (UI complete, WebRTC pending)
`Calls → Recent history` OR `Calls → Dial pad → [future: place call] → Active call`

Preview: **Recent → Preview incoming/active UI** (dev builds)

### Messaging
`Messages → Conversation list → Thread → Attachments`
`Messages → New message`

### Voicemail
`Voicemail → List → Detail → Mark read / Play`

### Contacts
`Contacts → Search / Favorites → Detail → [future: call/message]`

---

## 4. Wireframes & mockups

| Asset | Location |
|-------|----------|
| Dashboard shell | `docs/shell-demo.png` |
| Design system mockups | `docs/design-calling.png`, `docs/design-messaging.png` |

---

## 5. React Native implementation

All design components live under:

```
mobile-rn/src/
├── shared/theme/          colors, typography, tokens, ThemeContext
├── components/vsp/        VSP design system components
└── screens/               Feature screens using VSP components
```

Run the app:

```powershell
cd mobile-rn
npm start
```

Toggle **Settings → Theme** to verify light/dark parity with web portal.

---

## Accessibility

- All icon buttons include `accessibilityLabel`
- Dial keys expose `accessibilityRole="button"`
- Contrast ratios follow slate/indigo palette in both themes
- Touch targets meet 48dp minimum
