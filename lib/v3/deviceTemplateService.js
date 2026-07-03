/**
 * V3 Device Template Service — vendor-pluggable provisioning config generators.
 *
 * New vendors register in VENDOR_REGISTRY without modifying existing templates.
 */

const {
  buildEmployeeProvisioningProfile,
  buildExtensionConfigExport,
  TELNYX_SIP_CODECS,
} = require('../employeeProvisioningProfile');
const {
  buildGrandstreamPvalueXml,
  buildGrandstreamProvisionUrl,
} = require('./grandstreamPvalueConfig');

const SUPPORTED_VENDORS = Object.freeze([
  'yealink',
  'grandstream',
  'fanvil',
  'cisco',
  'poly',
  'snom',
]);

const DEFAULT_RTP = Object.freeze({
  portRangeStart: 10000,
  portRangeEnd: 20000,
  symmetricRtp: true,
  rtpTimeoutSec: 60,
});

function normalizeVendor(vendor) {
  return String(vendor || '').trim().toLowerCase();
}

function listVendors() {
  return SUPPORTED_VENDORS.map((id) => ({
    id,
    label: id.charAt(0).toUpperCase() + id.slice(1),
  }));
}

function assertVendor(vendor) {
  const id = normalizeVendor(vendor);
  if (!SUPPORTED_VENDORS.includes(id)) {
    throw Object.assign(new Error(`Unsupported vendor: ${vendor}`), { status: 400, code: 'INVALID_VENDOR' });
  }
  return id;
}

function buildProvisionContext({
  tenant,
  extension,
  user,
  phoneNumber,
  device,
  blfExtensions = [],
  options = {},
}) {
  const profile = buildEmployeeProvisioningProfile({
    tenant,
    extension,
    user,
    phoneNumber,
    includeSecrets: true,
  });
  const configExport = buildExtensionConfigExport(profile);
  const sip = profile.sip || {};
  const codecLabels = (sip.codecs || TELNYX_SIP_CODECS)
    .filter((c) => c.enabled !== false)
    .map((c) => c.label);

  return {
    version: device?.configVersion || 1,
    provisionVersion: device?.provisionVersion || 1,
    tenant: {
      id: tenant?.id,
      name: tenant?.name,
      timezone: tenant?.timezone || options.timezone || 'America/New_York',
    },
    device: {
      id: device?.id,
      vendor: device?.vendor,
      model: device?.model,
      macAddress: device?.macAddress,
      serialNumber: device?.serialNumber,
      firmwareVersion: device?.firmwareVersion,
    },
    employee: {
      id: user?.id,
      name: user?.name || extension?.displayName,
      email: user?.email,
    },
    extension: {
      id: extension?.id,
      number: extension?.extensionNumber,
      displayName: extension?.displayName || user?.name,
    },
    did: phoneNumber?.number || profile.assignedDid || null,
    sip: {
      username: sip.username,
      password: sip.password,
      authId: sip.authId || sip.username,
      server: sip.server,
      outboundProxy: sip.outboundProxy,
      transport: sip.transport || 'TLS',
      port: sip.portTls || sip.port,
      registrationExpirySec: sip.registrationExpirySec || 3600,
      srtp: sip.srtp || 'Optional',
      codecs: codecLabels,
      dtmfMode: sip.dtmfMode || 'RFC2833',
      stunServer: sip.stunServer || 'stun.telnyx.com:3478',
      symmetricRtp: sip.symmetricRtp !== false,
      dnsSrvLookup: sip.dnsSrvLookup !== false,
    },
    rtp: {
      ...DEFAULT_RTP,
      ...(options.rtp || {}),
    },
    vlan: options.vlan ?? device?.metadata?.vlan ?? 0,
    blfKeys: blfExtensions.map((ext) => ({
      extension: ext.extensionNumber,
      label: ext.displayName || ext.extensionNumber,
      type: 'blf',
    })),
    configExport,
  };
}

function generateYealinkConfig(ctx) {
  const lines = [
    '#!version:1.0.0.1',
    `account.1.label = ${ctx.extension.displayName}`,
    `account.1.display_name = ${ctx.extension.displayName}`,
    `account.1.auth_name = ${ctx.sip.authId}`,
    `account.1.user_name = ${ctx.sip.username}`,
    `account.1.password = ${ctx.sip.password}`,
    `account.1.sip_server.1.address = ${ctx.sip.server}`,
    `account.1.sip_server.1.port = ${ctx.sip.port}`,
    `account.1.sip_server.1.transport_type = ${ctx.sip.transport}`,
    `account.1.expires = ${ctx.sip.registrationExpirySec}`,
    `account.1.srtp_type = ${ctx.sip.srtp === 'Mandatory' ? 2 : 1}`,
    `local_time.time_zone = ${ctx.tenant.timezone}`,
    `network.vlan.internet_port_enable = ${ctx.vlan ? 1 : 0}`,
    `network.vlan.internet_port_vid = ${ctx.vlan || 0}`,
  ];
  ctx.sip.codecs.forEach((codec, i) => {
    lines.push(`account.1.codec.${i + 1}.enable = 1`);
    lines.push(`account.1.codec.${i + 1}.name = ${codec}`);
  });
  ctx.blfKeys.forEach((key, i) => {
    lines.push(`linekey.${i + 2}.type = 16`);
    lines.push(`linekey.${i + 2}.value = ${key.extension}`);
    lines.push(`linekey.${i + 2}.label = ${key.label}`);
  });
  return { contentType: 'text/plain', format: 'yealink-cfg', body: lines.join('\n') };
}

function generateGrandstreamConfig(ctx) {
  const payload = {
    'Account Name': ctx.employee?.name || ctx.extension?.displayName,
    'SIP Server': ctx.sip.server,
    'Secondary SIP Server': process.env.TELNYX_SIP_SERVER_SECONDARY?.trim() || '64.16.250.10',
    'Outbound Proxy': ctx.sip.outboundProxy,
    'SIP User ID': ctx.sip.username,
    'Authentication ID': ctx.sip.authId,
    'Authentication Password': ctx.sip.password,
    'SIP Port': ctx.sip.port,
    Transport: ctx.sip.transport,
    'Preferred Vocoder Order': ctx.sip.codecs,
    'DTMF Mode': ctx.sip.dtmfMode,
    'Registration Expiration': ctx.sip.registrationExpirySec,
    SRTP: ctx.sip.srtp,
    STUN: ctx.sip.stunServer,
    'Symmetric RTP': ctx.rtp.symmetricRtp,
    'RTP Port Range': `${ctx.rtp.portRangeStart}-${ctx.rtp.portRangeEnd}`,
    'DNS SRV': ctx.sip.dnsSrvLookup,
    'Display Name': ctx.extension.displayName,
    'Caller ID': ctx.did || ctx.extension.number,
    'Time Zone': ctx.tenant.timezone,
    'NTP Server': process.env.PROVISION_NTP_SERVER?.trim() || 'pool.ntp.org',
    VLAN: ctx.vlan || 0,
    BLF: ctx.blfKeys,
    'P-value XML Preview': buildGrandstreamPvalueXml(ctx),
  };
  return { contentType: 'application/json', format: 'grandstream-compatible', body: JSON.stringify(payload, null, 2) };
}

function generateFanvilConfig(ctx) {
  const lines = [
    '<config>',
    '  <sip>',
    `    <server>${ctx.sip.server}</server>`,
    `    <port>${ctx.sip.port}</port>`,
    `    <transport>${ctx.sip.transport}</transport>`,
    `    <username>${ctx.sip.username}</username>`,
    `    <authId>${ctx.sip.authId}</authId>`,
    `    <password>${ctx.sip.password}</password>`,
    `    <displayName>${ctx.extension.displayName}</displayName>`,
    `    <registerExpires>${ctx.sip.registrationExpirySec}</registerExpires>`,
    `    <srtp>${ctx.sip.srtp}</srtp>`,
    '  </sip>',
    `  <timezone>${ctx.tenant.timezone}</timezone>`,
    `  <vlan>${ctx.vlan || 0}</vlan>`,
    '</config>',
  ];
  return { contentType: 'application/xml', format: 'fanvil-xml', body: lines.join('\n') };
}

function generateCiscoConfig(ctx) {
  const lines = [
    '<flatProfile>',
    `<SIP_Server>${ctx.sip.server}</SIP_Server>`,
    `<SIP_Port>${ctx.sip.port}</SIP_Port>`,
    `<SIP_Transport>${ctx.sip.transport}</SIP_Transport>`,
    `<User_ID>${ctx.sip.username}</User_ID>`,
    `<Auth_ID>${ctx.sip.authId}</Auth_ID>`,
    `<Password>${ctx.sip.password}</Password>`,
    `<Display_Name>${ctx.extension.displayName}</Display_Name>`,
    `<Register_Expires>${ctx.sip.registrationExpirySec}</Register_Expires>`,
    `<SRTP>${ctx.sip.srtp}</SRTP>`,
    `<Time_Zone>${ctx.tenant.timezone}</Time_Zone>`,
    '</flatProfile>',
  ];
  return { contentType: 'application/xml', format: 'cisco-xml', body: lines.join('\n') };
}

function generatePolyConfig(ctx) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<polycomConfig>',
    `  <reg.reg1.displayName>${ctx.extension.displayName}</reg.reg1.displayName>`,
    `  <reg.reg1.address>${ctx.sip.username}</reg.reg1.address>`,
    `  <reg.reg1.auth.userId>${ctx.sip.authId}</reg.reg1.auth.userId>`,
    `  <reg.reg1.auth.password>${ctx.sip.password}</reg.reg1.auth.password>`,
    `  <reg.reg1.server.1.address>${ctx.sip.server}</reg.reg1.server.1.address>`,
    `  <reg.reg1.server.1.port>${ctx.sip.port}</reg.reg1.server.1.port>`,
    `  <reg.reg1.server.1.transport>${ctx.sip.transport}</reg.reg1.server.1.transport>`,
    `  <reg.reg1.expires>${ctx.sip.registrationExpirySec}</reg.reg1.expires>`,
    `  <sec.srtp.offer>${ctx.sip.srtp !== 'Disabled' ? 1 : 0}</sec.srtp.offer>`,
    `  <tcpIpApp.timezone>${ctx.tenant.timezone}</tcpIpApp.timezone>`,
    '</polycomConfig>',
  ];
  return { contentType: 'application/xml', format: 'poly-xml', body: lines.join('\n') };
}

function generateSnomConfig(ctx) {
  const lines = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<settings>',
    `  <phone_name>${ctx.extension.displayName}</phone_name>`,
    `  <sip_server>${ctx.sip.server}</sip_server>`,
    `  <sip_port>${ctx.sip.port}</sip_port>`,
    `  <transport>${ctx.sip.transport}</transport>`,
    `  <user_name>${ctx.sip.username}</user_name>`,
    `  <auth_name>${ctx.sip.authId}</auth_name>`,
    `  <password>${ctx.sip.password}</password>`,
    `  <display_name>${ctx.extension.displayName}</display_name>`,
    `  <registration_timer>${ctx.sip.registrationExpirySec}</registration_timer>`,
    `  <srtp>${ctx.sip.srtp}</srtp>`,
    `  <timezone>${ctx.tenant.timezone}</timezone>`,
    '</settings>',
  ];
  return { contentType: 'application/xml', format: 'snom-xml', body: lines.join('\n') };
}

const VENDOR_GENERATORS = Object.freeze({
  yealink: generateYealinkConfig,
  grandstream: generateGrandstreamConfig,
  fanvil: generateFanvilConfig,
  cisco: generateCiscoConfig,
  poly: generatePolyConfig,
  snom: generateSnomConfig,
});

function generateProvisionConfig(vendor, context) {
  const id = assertVendor(vendor);
  const generator = VENDOR_GENERATORS[id];
  const config = generator(context);
  return {
    vendor: id,
    configVersion: context.version,
    provisionVersion: context.provisionVersion,
    generatedAt: new Date().toISOString(),
    ...config,
  };
}

function buildProvisionUrl(device, vendor) {
  const id = normalizeVendor(vendor || device?.vendor);
  if (id === 'grandstream' && device?.macAddress) {
    const metadata = device.metadata && typeof device.metadata === 'object' ? device.metadata : {};
    return buildGrandstreamProvisionUrl(device.macAddress, metadata.provisionKey);
  }
  const base = (process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
  const deviceId = device?.id || device;
  return `${base}/api/v3/devices/${deviceId}/config?vendor=${encodeURIComponent(id)}`;
}

module.exports = {
  SUPPORTED_VENDORS,
  listVendors,
  assertVendor,
  buildProvisionContext,
  generateProvisionConfig,
  buildProvisionUrl,
};
