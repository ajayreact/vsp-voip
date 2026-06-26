# Performance tests (k6)

Load scripts for concurrent user targets from [../roadmap/06-performance-plan.md](../roadmap/06-performance-plan.md).

## Prerequisites

Install [k6](https://k6.io/docs/get-started/installation/).

## Scripts

| Script | VUs | Duration |
|--------|-----|----------|
| `k6-100-users.js` | 100 | 1m |
| `k6-500-users.js` | 500 | 2m |
| `k6-1000-users.js` | ramp to 1000 | ~7m |
| `k6-5000-users.js` | ramp to 5000 | ~11m |

## Run

```bash
API_BASE=http://localhost:3000 k6 run tests/performance/k6-100-users.js
API_BASE=https://api.vspphone.com k6 run tests/performance/k6-500-users.js
```

Or via npm:

```bash
npm run qa:perf:100
```

**Warning:** Do not run 1000/5000 scripts against production without approval.
