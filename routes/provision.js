/**
 * Public desk phone provisioning routes (no JWT).
 * Grandstream phones fetch cfg{MAC}.xml over HTTP/HTTPS.
 */

const express = require('express');
const { getPrisma } = require('../db');
const deviceProvisioningService = require('../lib/v3/deviceProvisioningService');
const {
  buildGrandstreamPvalueXml,
  buildGrandstreamProvisionFilename,
  buildGrandstreamConfigServerPath,
  isProvisionAccessAllowed,
  isDeviceProvisionable,
  normalizeMacForFilename,
} = require('../lib/v3/grandstreamPvalueConfig');

const router = express.Router();

function extractMacFromFilename(filename) {
  const match = String(filename || '').match(/^cfg([0-9a-f]{12})\.xml$/i);
  return match ? match[1].toUpperCase() : null;
}

async function findDeviceByMac(prisma, mac) {
  const normalized = normalizeMacForFilename(mac).toUpperCase();
  if (!normalized) return null;
  return prisma.v3DeskDevice.findFirst({
    where: {
      macAddress: normalized,
      status: { not: 'REMOVED' },
    },
  });
}

router.get('/:filename', async (req, res) => {
  try {
    const macFromPath = extractMacFromFilename(req.params.filename);
    if (!macFromPath) {
      return res.status(404).type('text/plain').send('Not found');
    }

    const prisma = await getPrisma();
    const device = await findDeviceByMac(prisma, macFromPath);
    if (!device) {
      return res.status(404).type('text/plain').send('Not found');
    }

    if (!isDeviceProvisionable(device)) {
      if (!device.extensionId) {
        return res.status(409).type('text/plain').send('Device not assigned to an extension');
      }
      return res.status(409).type('text/plain').send('Device not ready for provisioning');
    }

    const metadata = device.metadata && typeof device.metadata === 'object' ? device.metadata : {};
    if (!isProvisionAccessAllowed(metadata, req.query.key)) {
      return res.status(403).type('text/plain').send('Forbidden');
    }

    const generated = await deviceProvisioningService.generateDeviceConfig(
      prisma,
      device.tenantId,
      device.id,
    );

    if (String(device.vendor || '').toLowerCase() !== 'grandstream') {
      return res.status(415).type('text/plain').send('Unsupported vendor for this endpoint');
    }

    const xml = buildGrandstreamPvalueXml(generated.context);
    const expectedName = buildGrandstreamProvisionFilename(device.macAddress);
    if (req.params.filename.toLowerCase() !== expectedName.toLowerCase()) {
      return res.status(404).type('text/plain').send('Not found');
    }

    await prisma.v3DeskDevice.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() },
    });

    res.setHeader('Content-Type', 'application/xml; charset=UTF-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(xml);
  } catch (error) {
    console.error('[provision] cfg fetch failed:', error.message);
    res.status(500).type('text/plain').send('Provisioning error');
  }
});

module.exports = router;
