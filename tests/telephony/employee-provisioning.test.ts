import { describe, expect, it } from 'vitest';
import {
  buildEmployeeProvisioningProfile,
  buildMobileQrPayload,
  buildDeskQrPayload,
} from '../../lib/employeeProvisioningProfile.js';

describe('Phase 2.5 / employee provisioning profile', () => {
  const tenant = { id: 'tenant-1', name: 'Acme Corp' };
  const extension = {
    id: 'ext-1',
    tenantId: 'tenant-1',
    extensionNumber: '101',
    displayName: 'Front Desk',
  };
  const user = {
    id: 'user-1',
    name: 'Jane Doe',
    email: 'jane@acme.test',
    telnyxSipUsername: 'gencred-jane',
    telnyxSipPassword: 'secret-pass',
  };

  it('builds Telnyx-compliant SIP block without secrets by default', () => {
    const profile = buildEmployeeProvisioningProfile({
      tenant,
      extension,
      user,
      includeSecrets: false,
    });

    expect(profile.v).toBe(3);
    expect(profile.tenantId).toBe('tenant-1');
    expect(profile.employeeName).toBe('Jane Doe');
    expect(profile.extensionNumber).toBe('101');
    expect(profile.sip.server).toBe('sip.telnyx.com');
    expect(profile.sip.outboundProxy).toBe('sip.telnyx.com:5061');
    expect(profile.sip.transport).toBe('TLS');
    expect(profile.sip.password).toBeNull();
    expect(profile.sip.registrationExpirySec).toBe(3600);
    expect(profile.sip.symmetricRtp).toBe(true);
  });

  it('includes secrets only when explicitly requested (admin API / redeem)', () => {
    const profile = buildEmployeeProvisioningProfile({
      tenant,
      extension,
      user,
      includeSecrets: true,
    });
    expect(profile.sip.password).toBe('secret-pass');
  });

  it('mobile QR payload never embeds SIP password', () => {
    const expiresAt = new Date(Date.now() + 900000);
    const qr = buildMobileQrPayload({
      apiUrl: 'https://api.example.com',
      token: 'one-time-token',
      expiresAt,
      tenant,
      extension,
      user,
    });

    expect(qr.v).toBe(3);
    expect(qr.type).toBe('vsp-voip-provision');
    expect(qr.token).toBe('one-time-token');
    expect(qr.tenantName).toBe('Acme Corp');
    expect(JSON.stringify(qr)).not.toContain('secret-pass');
    expect(qr).not.toHaveProperty('sip');
  });

  it('desk QR payload uses secure token without embedded credentials', () => {
    const qr = buildDeskQrPayload({
      apiUrl: 'https://api.example.com',
      token: 'desk-token',
      expiresAt: new Date(),
      tenant,
      extension,
    });

    expect(qr.type).toBe('vsp-desk-provision');
    expect(qr.token).toBe('desk-token');
    expect(qr).not.toHaveProperty('sip');
  });
});
