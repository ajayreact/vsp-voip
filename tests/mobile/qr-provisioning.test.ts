import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseMobileProvisionQr, validateMobileProvisionQr } from '../../mobile-rn/src/auth/provisionQr';
import { sipProfileFromProvisioningProfile } from '../../mobile-rn/src/sip/provisioningProfile';

describe('mobile / QR provisioning (Phase 2.5)', () => {
  it('parses v3 mobile provision QR', () => {
    const payload = parseMobileProvisionQr(JSON.stringify({
      v: 3,
      type: 'vsp-voip-provision',
      target: 'mobile',
      apiUrl: 'https://api.example.com',
      token: 'abc123',
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      tenantId: 'tenant-1',
      tenantName: 'Acme',
      employeeName: 'Jane',
      extensionNumber: '101',
    }));

    expect(payload?.token).toBe('abc123');
    expect(validateMobileProvisionQr(payload!)).toBeNull();
  });

  it('maps redeemed provisioning profile to local SIP profile', () => {
    const profile = sipProfileFromProvisioningProfile({
      employeeName: 'Jane',
      extensionNumber: '101',
      displayName: 'Front Desk',
      assignedDid: '+15551234567',
      sip: {
        username: 'gencred-jane',
        password: 'secret',
        authId: 'gencred-jane',
        server: 'sip.telnyx.com',
        portTls: 5061,
        transport: 'TLS',
        outboundProxy: 'sip.telnyx.com:5061',
        registrationExpirySec: 3600,
        symmetricRtp: true,
        srtp: 'Optional',
      },
    });

    expect(profile.sipUsername).toBe('gencred-jane');
    expect(profile.password).toBe('secret');
    expect(profile.extension).toBe('101');
    expect(profile.outboundProxy).toBe('sip.telnyx.com:5061');
  });

  it('QrLoginScreen uses provisionWithQr flow', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'mobile-rn/src/screens/QrLoginScreen.tsx'),
      'utf8',
    );
    expect(source).toContain('provisionWithQr');
    expect(source).toContain('mapProvisionError');
    expect(source).not.toContain('loginWithQrToken(payload.token');
  });
});
