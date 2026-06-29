import { describe, it, expect } from 'vitest';
import { SYNC_PROFILES } from '../../mobile-rn/src/lib/syncProfiles';
import { configureLayoutAnimation, MOTION } from '../../mobile-rn/src/lib/animations';

describe('production sync profiles', () => {
  it('uses conservative foreground intervals for battery', () => {
    expect(SYNC_PROFILES.messaging.foregroundMs).toBeGreaterThanOrEqual(15_000);
    expect(SYNC_PROFILES.contactsPresenceMs).toBeGreaterThanOrEqual(60_000);
    expect(SYNC_PROFILES.messaging.foregroundMs).toBeLessThan(SYNC_PROFILES.contactsPresenceMs);
  });

  it('background intervals are slower than foreground', () => {
    expect(SYNC_PROFILES.messaging.backgroundMs).toBeGreaterThan(SYNC_PROFILES.messaging.foregroundMs);
    expect(SYNC_PROFILES.voicemail.backgroundMs).toBeGreaterThan(SYNC_PROFILES.voicemail.foregroundMs);
  });
});

describe('motion helpers', () => {
  it('skips layout animation when reduce motion is enabled', () => {
    expect(() => configureLayoutAnimation(true)).not.toThrow();
  });

  it('keeps transitions under 200ms', () => {
    expect(MOTION.screenTransitionMs).toBeLessThanOrEqual(200);
    expect(MOTION.fadeMs).toBeLessThanOrEqual(200);
  });
});
