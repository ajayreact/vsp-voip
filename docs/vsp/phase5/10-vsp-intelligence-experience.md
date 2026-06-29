# Phase 5.5 — VSP Intelligence Experience

Premium enterprise AI experience layer for the mobile app. **No backend changes.** All features reuse existing APIs, React Query caches, and AI modules from Phases 5.1–5.4.

## Architecture

```
Home Dashboard
  ├── IntelligenceHeader (profile + registration)
  ├── AskVspWidget → AI Assistant API
  ├── SmartAiBanner (derived recommendations)
  ├── DailyBriefCard (computed metrics)
  ├── BusinessInsightsSection (computed analytics)
  └── FlashList → RecommendationCard[]

Contact Detail
  └── CustomerTimelineSection (calls, messages, VM, cached insights)

Client-only
  └── Daily brief local notification (AsyncStorage dedupe)
```

**Data sources (read-only):**

| Source | Hook / store |
|--------|----------------|
| Dashboard stats | `fetchDashboardStats` + `appStore` |
| Calls | `useRecentCalls` |
| Voicemails | `useVoicemails` |
| Messages | `useConversations` |
| AI summaries | React Query cache `['ai-summary', …]` only |
| Assistant | Existing `/api/ai/assistant/*` via Ask VSP widget |

No new endpoints. No polling loops. No duplicate summary fetches.

## Dashboard

The Home screen is redesigned around **VSP Intelligence**:

- Time-based greeting + user name, business, extension, DID, registration status
- **VSP Daily Brief** expandable card with eight metrics + cached insights
- **Recommended by VSP** recommendation list (FlashList)
- **Ask VSP** persistent search with suggested prompts
- **VSP Business Insights** when activity data exists

## Widgets

| Widget | Module |
|--------|--------|
| Ask VSP | `components/intelligence/AskVspWidget.tsx` |
| Daily Brief | `components/intelligence/DailyBriefCard.tsx` |
| Recommendations | `components/intelligence/RecommendationCard.tsx` |
| Business Insights | `components/intelligence/BusinessInsightsSection.tsx` |
| Smart Banners | `components/intelligence/SmartAiBanner.tsx` |
| Customer Timeline | `components/intelligence/CustomerTimelineSection.tsx` |

## Recommendations

`intelligence/recommendations.ts` derives cards from:

- Missed calls (today / 48h)
- Unread SMS conversations
- Unread / urgent voicemails (priority from **cached** summaries only)
- Callback, follow-up, sales, and priority signals from **cached** AI summaries

Nothing is invented. If data is unavailable, the UI stays empty or shows a caught-up state.

## Daily Brief

`intelligence/dailyBrief.ts` computes:

- Today's calls, missed calls, unread messages, voicemails
- Urgent conversations, pending follow-ups, high-priority customers, callbacks
- Recent VSP insights from cached summaries

Local morning notification (`dailyBriefNotification.ts`) fires once per day (6–11 AM) using expo-notifications. No backend scheduler.

## Branding

All UI uses `ai/vspAiBranding.ts`:

- VSP Intelligence, Ask VSP, VSP Daily Brief
- Recommended by VSP, VSP Business Insights, VSP Customer Timeline
- Provider names never shown (`sanitizeAiUserMessage`)

## Performance

- `React.memo` on intelligence components
- `FlashList` for recommendation scrolling
- `useMemo` in `useIntelligenceDashboard` / `useCustomerTimeline`
- Reuses React Query caches; refetch only on pull-to-refresh
- Skeleton loading on Daily Brief and Home bootstrap

## Security

- No JWTs, SIP credentials, or provider names in UI
- Tenant isolation unchanged (existing API auth)
- Cached summaries only — no bulk AI export

## Future enhancements

- Server-pushed daily brief schedule
- Deep links from recommendation cards to detail screens
- Cross-device conversation history for Ask VSP
- RAG / knowledge-base integration (Phase 6+)
