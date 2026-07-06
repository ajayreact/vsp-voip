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
    // P-value numbers verified against Grandstream's official XML Configuration
    // File Generator template and the FusionPBX grandstream/grp26xx provisioning
    // template (P47=SIP Server, P48=Outbound Proxy, P130=SIP Transport,
    // P40=Local SIP Port — both host fields carry "host:port", not host alone).
    const xml = buildGrandstreamPvalueXml(ctx);
    expect(xml).toContain('<gs_provision');
    expect(xml).toContain('<P271>1</P271>');
    expect(xml).toContain('<P270>Ajay</P270>');
    expect(xml).toContain('<P47>sip.telnyx.com:5061</P47>');
    expect(xml).toContain('<P35>gencred-ajay</P35>');
    expect(xml).toContain('<P34>secret</P34>');
    expect(xml).toContain('<P130>1</P130>'); // 1 = TCP (forced — see transport test below)
    expect(xml).toContain('<P48>sip.telnyx.com:5061</P48>'); // outbound proxy, host:port
    expect(xml).not.toContain('<P4026>'); // not a valid P-value on this device family
    expect(xml).not.toContain('<P191>'); // P191 is "Enable Call Features", unrelated to transport
    expect(xml).not.toContain('<P280>'); // not a valid P-value — DTMF is 3 separate booleans
  });

  it('emits TCP transport (P130=1) and outbound proxy with port for a default desk profile', () => {
    // Regression: buildProvisionContext previously defaulted to TLS (P191=2) with
    // remote/local port forced to 5061, while the platform's desk phones actually
    // register over UDP on 5060 — producing a phone config with a mismatched
    // Outbound Proxy/Transport/Port combination that Telnyx's SIP edge would
    // never accept an INVITE against.
    //
    // Also a regression for the P-value mapping bug: P4026 does not exist on
    // GRP26xx (Outbound Proxy is P48), and P130/P191 were swapped relative to
    // their real meaning (P130=Transport, P191=unrelated "Enable Call Features"),
    // which is why Outbound Proxy/Transport showed blank/stale on the physical
    // phone even though the server-generated XML looked plausible.
    const deviceTemplateService = require('../../lib/v3/deviceTemplateService.js');
    const provisionCtx = deviceTemplateService.buildProvisionContext({
      tenant: { id: 't1', name: 'Acme', timezone: 'America/New_York' },
      extension: { id: 'e1', extensionNumber: '101', displayName: 'Jane Doe' },
      user: { id: 'u1', name: 'Jane Doe', telnyxSipUsername: 'gencred-jane', telnyxSipPassword: 'secret' },
      device: { id: 'd1', vendor: 'grandstream', macAddress: 'AABBCCDDEEFF', configVersion: 1, provisionVersion: 1 },
    });

    expect(provisionCtx.sip.port).toBe(5060);
    expect(provisionCtx.sip.outboundProxy).toBe('sip.telnyx.com:5060');

    const xml = buildGrandstreamPvalueXml(provisionCtx);
    expect(xml).toContain('<P130>1</P130>'); // 1 = TCP (forced, see transport-forcing test)
    expect(xml).toContain('<P40>5060</P40>'); // local SIP port (fixed)
    expect(xml).toContain('<P47>sip.telnyx.com:5060</P47>'); // SIP server, host:port
    expect(xml).toContain('<P48>sip.telnyx.com:5060</P48>'); // outbound proxy, host:port
  });

  it('forces TCP transport (P130=1) regardless of the upstream sip.transport value', () => {
    // Runtime evidence (2026-07-06 packet capture, GRP2601 fw 1.0.7.11): the
    // ~1738-byte multi-codec UDP INVITE fragments into 2 IP packets and gets
    // zero SIP response, while every unfragmented REGISTER on the identical
    // path succeeds. Transport is intentionally hardcoded to TCP for this
    // vendor's builder to remove the IP-fragmentation dependency for SIP
    // signaling, independent of whatever transport was requested upstream.
    for (const requested of ['UDP', 'TLS', 'TCP', undefined]) {
      const xml = buildGrandstreamPvalueXml({ ...ctx, sip: { ...ctx.sip, transport: requested } });
      expect(xml).toContain('<P130>1</P130>');
    }
  });

  it('maps DTMF mode to the three independent P2301/P2302/P2303 booleans', () => {
    const rfc2833Xml = buildGrandstreamPvalueXml(ctx);
    expect(rfc2833Xml).toContain('<P2301>0</P2301>'); // in-audio: off
    expect(rfc2833Xml).toContain('<P2302>1</P2302>'); // RFC2833: on
    expect(rfc2833Xml).toContain('<P2303>0</P2303>'); // SIP INFO: off

    const infoXml = buildGrandstreamPvalueXml({ ...ctx, sip: { ...ctx.sip, dtmfMode: 'SIP INFO' } });
    expect(infoXml).toContain('<P2301>0</P2301>');
    expect(infoXml).toContain('<P2302>0</P2302>');
    expect(infoXml).toContain('<P2303>1</P2303>');
  });

  it('builds MAC-based provision filename and optional manual URL', () => {
    process.env.API_PUBLIC_URL = 'https://api.vspphone.com';
    expect(buildGrandstreamProvisionFilename('EC:74:D7:51:E3:E7')).toBe('cfgec74d751e3e7.xml');
    expect(buildGrandstreamConfigServerPath()).toBe('https://api.vspphone.com/provision/');
    const url = buildGrandstreamProvisionUrl('EC74D751E3E7', 'abc123');
    expect(url).toBe('https://api.vspphone.com/provision/cfgec74d751e3e7.xml?key=abc123');
  });
});
