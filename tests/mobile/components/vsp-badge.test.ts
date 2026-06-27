import '../setup';
import { describe, it, expect } from 'vitest';
import {
  VspBadge,
  VspChip,
  VspSegmentedControl,
} from '../../../mobile-rn/src/components/vsp/VspBadge';

describe('VspBadge components', () => {
  it('exports VspBadge', () => {
    expect(typeof VspBadge).toBe('function');
    expect(VspBadge.name).toBe('VspBadge');
  });

  it('exports VspChip', () => {
    expect(typeof VspChip).toBe('function');
    expect(VspChip.name).toBe('VspChip');
  });

  it('exports VspSegmentedControl', () => {
    expect(typeof VspSegmentedControl).toBe('function');
    expect(VspSegmentedControl.name).toBe('VspSegmentedControl');
  });
});
