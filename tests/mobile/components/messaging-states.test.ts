import '../setup';
import { describe, it, expect } from 'vitest';
import {
  MessagingStateBanner,
  MessageDateSeparator,
} from '../../../mobile-rn/src/components/messaging/MessagingStates';

describe('MessagingStates components', () => {
  it('exports MessagingStateBanner', () => {
    expect(typeof MessagingStateBanner).toBe('function');
    expect(MessagingStateBanner.name).toBe('MessagingStateBanner');
  });

  it('exports MessageDateSeparator', () => {
    expect(typeof MessageDateSeparator).toBe('function');
    expect(MessageDateSeparator.name).toBe('MessageDateSeparator');
  });
});
