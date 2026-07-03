import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const deviceTemplateService = require('../../lib/v3/deviceTemplateService.js');

describe('V3 deviceTemplateService', () => {
  const baseContext = {
    tenant: { id: 't1', name: 'Acme', timezone: 'America/New_York' },
    extension: { id: 'e1', extensionNumber: '101', displayName: 'Jane Doe' },
    user: { id: 'u1', name: 'Jane Doe', email: 'jane@test.com', telnyxSipUsername: 'sip-user', telnyxSipPassword: 'secret' },
    phoneNumber: { number: '+15551230001' },
    device: { id: 'd1', vendor: 'yealink', macAddress: 'AABBCCDDEEFF', configVersion: 1, provisionVersion: 1 },
    blfExtensions: [{ extensionNumber: '102', displayName: 'Bob' }],
  };

  it('lists all supported vendors', () => {
    const vendors = deviceTemplateService.listVendors();
    expect(vendors.map((v: { id: string }) => v.id)).toEqual(
      expect.arrayContaining(['yealink', 'grandstream', 'fanvil', 'cisco', 'poly', 'snom']),
    );
  });

  it('generates Yealink config with SIP and BLF keys', () => {
    const ctx = deviceTemplateService.buildProvisionContext(baseContext);
    const config = deviceTemplateService.generateProvisionConfig('yealink', ctx);
    expect(config.format).toBe('yealink-cfg');
    expect(config.body).toContain('account.1.user_name');
    expect(config.body).toContain('linekey.2.type');
  });

  it('generates Grandstream JSON config', () => {
    const ctx = deviceTemplateService.buildProvisionContext({ ...baseContext, device: { ...baseContext.device, vendor: 'grandstream' } });
    const config = deviceTemplateService.generateProvisionConfig('grandstream', ctx);
    expect(config.format).toBe('grandstream-compatible');
    const parsed = JSON.parse(config.body);
    expect(parsed['SIP User ID']).toBeTruthy();
    expect(parsed['Display Name']).toBe('Jane Doe');
  });

  it('rejects unsupported vendor', () => {
    expect(() => deviceTemplateService.assertVendor('unknown')).toThrow(/Unsupported vendor/);
  });
});
