# V3 Testing Guide

## Test Suite

```bash
npx vitest run tests/v3          # 130 tests — V3 gate
npm test                         # Full suite
npx tsc --noEmit                 # web/
npx eslint "src/app/(app)/v3/**" # V3 ESLint gate
```

## Structure

- Location: `tests/v3/*.test.ts`
- Framework: Vitest
- Pattern: mock Prisma, require service directly

## Writing Tests

```typescript
import { describe, it, expect, vi } from 'vitest';
const myService = require('../../lib/v3/myService.js');

describe('myService', () => {
  it('scopes by tenant', async () => {
    const prisma = { /* mocked delegates */ };
    // ...
  });
});
```

## Required Coverage Areas

- Tenant isolation
- Role/permission errors
- Happy path CRUD
- Error codes (`TENANT_MISMATCH`, etc.)

## Pre-Deploy Validation

```bash
npm run validate:migrations
npx prisma validate
```

## Telephony Regression

Portal-only GA: `tests/v3` sufficient.

Before runtime sync enablement: `npm run qa:full`

## CI Expectations

| Gate | Target |
|------|--------|
| V3 tests | 130/130 |
| V3 ESLint | 0 issues |
| TypeScript | pass |

Full suite may have 2 environmental API auth failures — not V3 blockers.
