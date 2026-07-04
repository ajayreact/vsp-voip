import { describe, it, expect } from 'vitest';
import {
  isTrustedProvisionHost,
  resolveApiEnvironmentLabel,
} from '../../mobile-rn/src/shared/config/apiEnvironment';

describe('resolveApiEnvironmentLabel', () => {
  it('labels production hosts', () => {
    expect(resolveApiEnvironmentLabel('https://api.vspphone.com')).toBe('Production');
  });

  it('labels development hosts', () => {
    expect(resolveApiEnvironmentLabel('http://localhost:3000')).toBe('Development');
  });

  it('labels staging hosts', () => {
    expect(resolveApiEnvironmentLabel('https://staging.example.com')).toBe('Staging');
  });
});

describe('isTrustedProvisionHost', () => {
  it('accepts the configured API origin', () => {
    expect(isTrustedProvisionHost('https://api.vspphone.com', 'https://api.vspphone.com', false)).toBe(true);
  });

  it('accepts the production host when configured differently', () => {
    expect(isTrustedProvisionHost('https://api.vspphone.com/api', 'http://localhost:3000', true)).toBe(true);
  });

  it('rejects unknown hosts in release mode', () => {
    expect(isTrustedProvisionHost('https://evil.example.com', 'https://api.vspphone.com', false)).toBe(false);
  });

  it('allows localhost only in development mode', () => {
    expect(isTrustedProvisionHost('http://localhost:3000', 'http://localhost:3000', true)).toBe(true);
    expect(isTrustedProvisionHost('http://localhost:3000', 'https://api.vspphone.com', false)).toBe(false);
  });
});
