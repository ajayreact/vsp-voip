import { describe, it } from 'vitest';

/**
 * Conference calling — not implemented in production code.
 * Tests document expected API surface for future implementation.
 */
describe('telephony / conference (planned)', () => {
  it.todo('POST /api/softphone/conference/create — v1.4');
  it.todo('POST /api/softphone/conference/add-participant — v1.4');
  it.todo('Telnyx conference webhook handlers — v1.4');
});
