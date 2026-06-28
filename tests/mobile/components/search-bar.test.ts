import '../setup';
import { describe, it, expect } from 'vitest';
import { SearchBar } from '../../../mobile-rn/src/components/SearchBar';

describe('SearchBar component', () => {
  it('exports SearchBar', () => {
    expect(typeof SearchBar).toBe('function');
    expect(SearchBar.name).toBe('SearchBar');
  });
});
