import '../setup';
import { describe, it, expect } from 'vitest';
import { ErrorBoundary } from '../../../mobile-rn/src/components/ErrorBoundary';

describe('ErrorBoundary', () => {
  it('getDerivedStateFromError captures the error', () => {
    const error = new Error('component crash');
    expect(ErrorBoundary.getDerivedStateFromError(error)).toEqual({ error });
  });

  it('initial state has no error', () => {
    const boundary = new ErrorBoundary({ children: null });
    expect(boundary.state.error).toBeNull();
  });
});
