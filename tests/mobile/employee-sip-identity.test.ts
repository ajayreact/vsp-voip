import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('mobile / employee SIP identity (Phase 2.4a)', () => {
  it('hydrateSipProfile uses employee softphone token path for all roles', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'mobile-rn/src/sip/service.ts'),
      'utf8',
    );
    expect(source).not.toContain('fetchExtensionSipCredentials');
    expect(source).not.toContain('isAdminRole');
    expect(source).toContain('fetchSoftphoneToken');
  });
});
