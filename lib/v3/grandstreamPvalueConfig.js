/**
 * Grandstream GRP260x P-value XML config generator for HTTP provisioning.
 * Maps V3 provision context to firmware-consumable cfg{MAC}.xml format.
 */

const SECONDARY_SIP_SERVER = process.env.TELNYX_SIP_SERVER_SECONDARY?.trim() || '64.16.250.10';
const DEFAULT_NTP_SERVER = process.env.PROVISION_NTP_SERVER?.trim() || 'pool.ntp.org';

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function transportCode(transport) {
  const t = String(transport || 'TLS').toUpperCase();
  if (t === 'UDP') return '0';
  if (t === 'TCP') return '1';
  return '2';
}

// Account 1 DTMF mode is three independent booleans on this device family
// (P2301/P2302/P2303) — there is no single enum P-value for it.
function dtmfFlags(mode) {
  const raw = String(mode || 'RFC2833').toLowerCase();
  const isSipInfo = raw.includes('info');
  const isInBand = raw.includes('in-band') || raw.includes('inband');
  const isRfc2833 = !isSipInfo && !isInBand;
  return {
    inAudio: isInBand ? '1' : '0',
    rfc2833: isRfc2833 ? '1' : '0',
    sipInfo: isSipInfo ? '1' : '0',
  };
}

function outboundProxyHost(outboundProxy, server) {
  const raw = String(outboundProxy || server || '').trim();
  return raw.split(':')[0] || server || '';
}

/**
 * Build Grandstream gs_provision XML for Account 1 (GRP260x series).
 * @param {object} ctx - deviceTemplateService buildProvisionContext output
 */
function buildGrandstreamPvalueXml(ctx) {
  const sip = ctx.sip || {};
  const ext = ctx.extension || {};
  const employee = ctx.employee || {};
  const tenant = ctx.tenant || {};
  const accountName = employee.name || ext.displayName || ext.number || 'Account 1';
  const displayName = ext.displayName || employee.name || accountName;
  // Transport forced to TCP for this vendor: a 2026-07-06 packet capture
  // (Grandstream GRP2601, fw 1.0.7.11) proved the multi-codec UDP INVITE
  // (~1738 bytes) splits into 2 IP fragments and receives zero SIP response,
  // while every unfragmented REGISTER on the identical phone/NAT/Telnyx-edge
  // path succeeds reliably. TCP removes the IP-fragmentation dependency for
  // SIP signaling entirely (segmentation/reassembly handled by the TCP
  // stack, not by NAT/firewall fragment tracking). Scoped to this Grandstream
  // builder only — other vendor templates are unaffected.
  const transport = 'TCP';
  const remotePort = String(sip.port || (transport === 'TLS' ? '5061' : '5060'));
  const proxyHost = outboundProxyHost(sip.outboundProxy, sip.server);
  const server = sip.server || 'sip.telnyx.com';
  const dtmf = dtmfFlags(sip.dtmfMode);

  // P-value mapping verified against Grandstream's official XML Configuration
  // File Generator template and the FusionPBX grandstream/grp26xx provisioning
  // template (field-by-field comment reference for this device family).
  // P47/P48 carry "host:port" directly — there is no separate remote-port P-value.
  const pairs = [
    ['P271', '1'],
    ['P270', accountName],
    ['P3', displayName],
    ['P47', `${server}:${remotePort}`],
    ['P7402', SECONDARY_SIP_SERVER],
    ['P35', sip.username || ''],
    ['P36', sip.authId || sip.username || ''],
    ['P34', sip.password || ''],
    ['P48', `${proxyHost}:${remotePort}`],
    ['P130', transportCode(transport)],
    ['P40', '5060'],
    ['P31', '1'],
    ['P32', String(sip.registrationExpirySec || 3600)],
    ['P2301', dtmf.inAudio],
    ['P2302', dtmf.rfc2833],
    ['P2303', dtmf.sipInfo],
    ['P104', DEFAULT_NTP_SERVER],
    ['P146', tenant.timezone || 'America/New_York'],
    ['P193', sip.dnsSrvLookup === false ? '0' : '1'],
    ['P26061', sip.symmetricRtp === false ? '0' : '1'],
  ];

  if (ctx.did || ext.number) {
    pairs.push(['P4234', ctx.did || ext.number]);
  }

  ctx.blfKeys?.slice(0, 5).forEach((key, index) => {
    const mpkIndex = 1363 + index;
    pairs.push([`P${mpkIndex}`, '1']);
    pairs.push([`P${mpkIndex + 100}`, String(key.extension || '')]);
    pairs.push([`P${mpkIndex + 200}`, String(key.label || key.extension || '')]);
  });

  const body = pairs
    .filter(([, value]) => value !== '' && value != null)
    .map(([p, value]) => `    <${p}>${xmlEscape(value)}</${p}>`)
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8" ?>',
    '<gs_provision version="1">',
    '  <config version="1">',
    body,
    '  </config>',
    '</gs_provision>',
  ].join('\n');
}

function normalizeMacForFilename(mac) {
  return String(mac || '').replace(/[^A-F0-9]/gi, '').toLowerCase();
}

function buildGrandstreamConfigServerPath() {
  const base = (process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
  return `${base}/provision/`;
}

function buildGrandstreamProvisionFilename(mac) {
  return `cfg${normalizeMacForFilename(mac)}.xml`;
}

/** Full cfg URL — optional key for manual/browser download only. */
function buildGrandstreamProvisionUrl(mac, provisionKey) {
  const base = buildGrandstreamConfigServerPath();
  const filename = buildGrandstreamProvisionFilename(mac);
  const key = provisionKey ? `?key=${encodeURIComponent(provisionKey)}` : '';
  return `${base}${filename}${key}`;
}

/**
 * Grandstream phones fetch cfg{MAC}.xml without query params.
 * Key is optional — enforced only when ?key= is present in the request.
 */
function isProvisionAccessAllowed(metadata, queryKey) {
  const hasQueryKey = queryKey != null && String(queryKey) !== '';
  if (!hasQueryKey) return true;
  const provisionKey = metadata?.provisionKey || null;
  if (!provisionKey) return true;
  return String(queryKey) === String(provisionKey);
}

const PROVISIONABLE_DEVICE_STATUSES = new Set(['ASSIGNED', 'PROVISIONED', 'REGISTERED']);

function isDeviceProvisionable(device) {
  if (!device || device.status === 'REMOVED') return false;
  if (!device.extensionId) return false;
  return PROVISIONABLE_DEVICE_STATUSES.has(device.status)
    || device.lastProvisionedAt != null;
}

module.exports = {
  buildGrandstreamPvalueXml,
  buildGrandstreamProvisionFilename,
  buildGrandstreamConfigServerPath,
  buildGrandstreamProvisionUrl,
  isProvisionAccessAllowed,
  isDeviceProvisionable,
  normalizeMacForFilename,
};
