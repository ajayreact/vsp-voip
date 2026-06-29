import '../setup';
import { describe, it, expect } from 'vitest';
import { ErrorBoundary } from '../../../mobile-rn/src/components/ErrorBoundary';
import { getFriendlyErrorMessage } from '../../../mobile-rn/src/utils/friendlyError';

describe('ErrorBoundary', () => {
  it('getDerivedStateFromError captures the error', () => {
    const error = new Error('component crash');
    expect(ErrorBoundary.getDerivedStateFromError(error)).toEqual({ error });
  });

  it('initial state has no error', () => {
    const boundary = new ErrorBoundary({ children: null });
    expect(boundary.state.error).toBeNull();
  });

  it('maps raw network errors to friendly messages', () => {
    expect(getFriendlyErrorMessage(new Error('Network Error'))).toBe(
      'Something went wrong. Please try again.',
    );
  });
});
