import 'dotenv/config';

const TARGET_NUMBERS = ['+19563961388', '+17748123836', '+13099880196'];

function formatUs(number: string): string {
  const d = number.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) {
    return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  return number;
}

async function main() {
  const { PrismaClient } = await import('../generated/prisma/client.js');
  const { PrismaPg } = await import('@prisma/adapter-pg');
  const { resolveOwnershipChain } = await import('../lib/pbxOwnership.js');

  const ONLINE_WINDOW_MS = 5 * 60 * 1000;
  const MOBILE_STALE_MS = 24 * 60 * 60 * 1000;

  function deriveDeviceRows(extension: {
    webrtcEnabled: boolean;
    sipEnabled: boolean;
    sipUsername: string | null;
    sipPassword: string | null;
    user?: {
      telnyxSipUsername?: string | null;
      softphoneOnlineAt?: Date | null;
      sipRegistered?: boolean | null;
      sipRegistrationCheckedAt?: Date | null;
      devices?: Array<{ id: string; platform: string; deviceName: string | null; lastSeenAt: Date | null }>;
    } | null;
  }, now = Date.now()) {
    const rows: Array<{ deviceType: string; deviceName: string; status: string; lastRegistrationAt: Date | null }> = [];
    const user = extension.user;
    if (extension.webrtcEnabled && user?.telnyxSipUsername) {
      const onlineAt = user.softphoneOnlineAt ? new Date(user.softphoneOnlineAt).getTime() : 0;
      const online = Boolean(user.sipRegistered) && onlineAt && now - onlineAt <= ONLINE_WINDOW_MS;
      rows.push({ deviceType: 'WEBRTC', deviceName: 'Web softphone', status: online ? 'ONLINE' : 'OFFLINE', lastRegistrationAt: user.softphoneOnlineAt || null });
    }
    for (const device of user?.devices || []) {
      const age = device.lastSeenAt ? now - new Date(device.lastSeenAt).getTime() : Infinity;
      const status = !device.lastSeenAt ? 'OFFLINE' : age <= MOBILE_STALE_MS ? 'ONLINE' : 'OFFLINE';
      rows.push({ deviceType: 'MOBILE', deviceName: device.deviceName || `${device.platform} device`, status, lastRegistrationAt: device.lastSeenAt });
    }
    if (extension.sipEnabled && (extension.sipUsername || extension.sipPassword || user?.telnyxSipUsername)) {
      rows.push({
        deviceType: 'SIP',
        deviceName: extension.sipUsername ? `SIP (${extension.sipUsername})` : 'SIP endpoint',
        status: user?.sipRegistered ? 'ONLINE' : 'OFFLINE',
        lastRegistrationAt: user?.sipRegistrationCheckedAt || user?.softphoneOnlineAt || null,
      });
    }
    return rows;
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    console.log('=== MOBILE ROUTING PATH DIAGNOSTIC ===\n');
    console.log(`Ownership model: Company → Extension → DID → Employee → Device → Telnyx\n`);

    for (const number of TARGET_NUMBERS) {
      const phone = await prisma.phoneNumber.findFirst({
        where: { number },
        include: {
          tenant: { select: { id: true, name: true } },
          extension: {
            include: {
              user: {
                include: {
                  devices: { orderBy: { lastSeenAt: 'desc' } },
                },
              },
            },
          },
          assignedUser: {
            include: {
              devices: { orderBy: { lastSeenAt: 'desc' } },
            },
          },
        },
      });

      console.log('─'.repeat(72));
      console.log(`DID: ${formatUs(number)} (${number})`);

      if (!phone) {
        console.log('  STATUS: NOT FOUND IN DATABASE\n');
        continue;
      }

      const chain = await resolveOwnershipChain(prisma, phone.tenantId, phone.id);
      const extension = phone.extension
        || (phone.assignedUserId
          ? await prisma.extension.findFirst({
            where: { tenantId: phone.tenantId, userId: phone.assignedUserId, status: 'ACTIVE' },
            include: {
              user: { include: { devices: { orderBy: { lastSeenAt: 'desc' } } } },
            },
          })
          : null);

      const employee = extension?.user || phone.assignedUser;
      const deviceRows = extension ? deriveDeviceRows(extension) : [];

      const telnyxDialUri = employee?.telnyxSipUsername
        ? `sip:${employee.telnyxSipUsername}@sip.telnyx.com`
        : null;

      console.log(`  Company:     ${phone.tenant?.name || phone.tenantId}`);
      console.log(`  Extension:   ${extension ? `${extension.extensionNumber} — ${extension.displayName}` : '— (none)'}`);
      console.log(`  Employee:    ${employee ? `${employee.name} (${employee.email})` : '— (none)'}`);
      console.log(`  Routing:     ${phone.routingType}${phone.extensionId ? ' (extension-linked)' : ''}`);

      console.log('\n  Chain:');
      console.log(`    DID → ${formatUs(phone.number)}`);
      console.log(`      → Extension ${extension?.extensionNumber || '—'}`);
      console.log(`      → Employee ${employee?.name || '—'}`);
      console.log(`      → Telnyx user credential: ${employee?.telnyxSipUsername || '— NOT PROVISIONED —'}`);
      console.log(`      → Inbound dial URI: ${telnyxDialUri || '— CANNOT DIAL —'}`);

      console.log('\n  Devices (derived):');
      if (!deviceRows.length) {
        console.log('    (none registered)');
      } else {
        for (const d of deviceRows) {
          console.log(`    • ${d.deviceType} — ${d.deviceName} — ${d.status}${d.lastRegistrationAt ? ` (last: ${new Date(d.lastRegistrationAt).toISOString()})` : ''}`);
        }
      }

      if (employee?.devices?.length) {
        console.log('\n  Mobile device records (UserDevice):');
        for (const d of employee.devices) {
          console.log(`    • ${d.platform} — ${d.deviceName || d.deviceId} — push: ${d.pushToken ? 'yes' : 'no'} — last seen: ${d.lastSeenAt?.toISOString?.() || 'never'}`);
        }
      }

      if (extension) {
        console.log('\n  Desk SIP (extension credential — separate from inbound dial):');
        console.log(`    sipUsername: ${extension.sipUsername || extension.extensionNumber}`);
        console.log(`    sipEnabled: ${extension.sipEnabled}`);
        console.log(`    hasPassword: ${Boolean(extension.sipPassword)}`);
      }

      console.log('\n  Telnyx registration signals:');
      console.log(`    user.sipRegistered: ${Boolean(employee?.sipRegistered)}`);
      console.log(`    user.telnyxCredentialId: ${employee?.telnyxCredentialId || '—'}`);
      console.log(`    user.softphoneOnlineAt: ${employee?.softphoneOnlineAt?.toISOString?.() || '—'}`);
      console.log(`    user.pushDeviceToken: ${employee?.pushDeviceToken ? 'set' : '—'}`);

      const webrtc = deviceRows.find((d) => d.deviceType === 'WEBRTC');
      const mobile = deviceRows.filter((d) => d.deviceType === 'MOBILE');
      const sip = deviceRows.find((d) => d.deviceType === 'SIP');

      const willRingWebRtc = Boolean(telnyxDialUri && webrtc?.status === 'ONLINE');
      const willRingMobile = Boolean(
        telnyxDialUri
        && (mobile.some((d) => d.status === 'ONLINE') || Boolean(employee?.pushDeviceToken)),
      );
      const willRingDeskSip = Boolean(
        extension?.sipEnabled
        && extension?.sipUsername
        && sip?.status === 'ONLINE',
      );

      console.log('\n  Will inbound currently ring?');
      console.log(`    1. Mobile App:      ${willRingMobile ? 'LIKELY YES (push/credential)' : 'NO — no push token or stale mobile device'}`);
      console.log(`    2. WebRTC Browser:  ${willRingWebRtc ? 'YES — browser online + sipRegistered' : 'NO — browser not online or not registered'}`);
      console.log(`    3. SIP Desk Phone:  ${willRingDeskSip ? 'MONITORING ONLY — see gap below' : 'NO — not registered or sip disabled'}`);
      console.log(`       ⚠ Inbound Call Control dials User.telnyxSipUsername only, NOT Extension.sipUsername`);

      if (chain.issues?.length) {
        console.log('\n  Issues:');
        for (const issue of chain.issues) console.log(`    • ${issue}`);
      }

      console.log(`\n  canReceiveInbound (chain validator): ${chain.canReceiveInbound}`);
      console.log(`  canRingEmployee (ring target resolved): ${chain.inbound?.canRingEmployee}\n`);
    }

    console.log('=== GLOBAL GAPS ===');
    console.log('• Inbound dials sip:{User.telnyxSipUsername}@sip.telnyx.com — shared by WebRTC + Mobile');
    console.log('• Desk phones use Extension.sipUsername/password — NOT included in inbound dial path');
    console.log('• Server does not filter by device online status before dialing Telnyx');
    console.log('• multiDeviceEnabled flag is not used in inbound routing code');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
