import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  buildGrandstreamPvalueXml,
  buildGrandstreamProvisionFilename,
  buildGrandstreamConfigServerPath,
  buildGrandstreamProvisionUrl,
} = require('../../lib/v3/grandstreamPvalueConfig.js');

describe('grandstreamPvalueConfig', () => {
  const ctx = {
    tenant: { timezone: 'America/New_York' },
    employee: { name: 'Ajay' },
    extension: { number: '100', displayName: 'Ajay' },
    did: '+13139215654',
    sip: {
      server: 'sip.telnyx.com',
      outboundProxy: 'sip.telnyx.com:5061',
      username: 'gencred-ajay',
      authId: 'gencred-ajay',
      password: 'secret',
      transport: 'TLS',
      port: 5061,
      registrationExpirySec: 3600,
      dtmfMode: 'RFC2833',
      dnsSrvLookup: true,
      symmetricRtp: true,
    },
    blfKeys: [{ extension: '101', label: 'Darwin' }],
    rtp: { portRangeStart: 10000, portRangeEnd: 20000, symmetricRtp: true },
  };

  it('builds P-value XML with required SIP fields', () => {
    const xml = buildGrandstreamPvalueXml(ctx);
    expect(xml).toContain('<gs_provision');
    expect(xml).toContain('<P271>1</P271>');
    expect(xml).toContain('<P270>Ajay</P270>');
    expect(xml).toContain('<P47>sip.telnyx.com</P47>');
    expect(xml).toContain('<P35>gencred-ajay</P35>');
    expect(xml).toContain('<P34>secret</P34>');
    expect(xml).toContain('<P191>2</P191>');
  });

  it('builds MAC-based provision filename and optional manual URL', () => {
    process.env.API_PUBLIC_URL = 'https://api.vspphone.com';
    expect(buildGrandstreamProvisionFilename('EC:74:D7:51:E3:E7')).toBe('cfgec74d751e3e7.xml');
    expect(buildGrandstreamConfigServerPath()).toBe('https://api.vspphone.com/provision/');
    const url = buildGrandstreamProvisionUrl('EC74D751E3E7', 'abc123');
    expect(url).toBe('https://api.vspphone.com/provision/cfgec74d751e3e7.xml?key=abc123');
  });
});
