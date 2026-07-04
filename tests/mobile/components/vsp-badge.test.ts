import '../setup';
import { describe, it, expect } from 'vitest';
import {
  VspBadge,
  VspChip,
  VspSegmentedControl,
} from '../../../mobile-rn/src/components/vsp/VspBadge';

describe('VspBadge components', () => {
  it('exports VspBadge', () => {
    expect(VspBadge).toBeTruthy();
    expect(typeof VspBadge === 'function' || typeof VspBadge === 'object').toBe(true);
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
