import { describe, it, expect, afterEach } from 'vitest';
import http from 'http';

const fs = require('fs');
const path = require('path');
const attachmentService = require('../../lib/messaging/AttachmentService');
const webhookService = require('../../lib/messaging/WebhookService');

describe('inbound MMS media handling', () => {
  let server;
  let serverUrl;

  afterEach(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      server = null;
      serverUrl = null;
    }
  });

  async function startFixtureServer(body, contentType) {
    server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(body);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    serverUrl = `http://127.0.0.1:${port}/media.png`;
  }

  it('extracts inbound media metadata from Telnyx payload', () => {
    const items = webhookService.extractInboundMediaItems({
      media: [{
        url: 'https://media.telnyx.com/abc/image.jpg',
        content_type: 'image/jpeg',
        filename: 'photo.jpg',
      }],
    });

    expect(items).toHaveLength(1);
    expect(items[0].contentType).toBe('image/jpeg');
    expect(items[0].fileName).toBe('photo.jpg');
  });

  it('allows common inbound MIME types from Telnyx', () => {
    expect(attachmentService.isInboundMimeAllowed('image/jpeg')).toBe(true);
    expect(attachmentService.isInboundMimeAllowed('video/mp4')).toBe(true);
    expect(attachmentService.isInboundMimeAllowed('application/x-msdownload')).toBe(false);
  });

  it('downloads inbound media and stores a durable local URL', async () => {
    const pngBytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    await startFixtureServer(pngBytes, 'image/png');

    const row = await attachmentService.persistInboundAttachment({
      tenantId: 'tenant-test',
      telnyxMessageId: 'tx-inbound-1',
      messageId: 'msg-1',
      index: 0,
      item: {
        url: serverUrl,
        contentType: 'image/png',
        fileName: 'image.png',
      },
    });

    expect(row.sizeBytes).toBe(pngBytes.length);
    expect(row.mimeType).toBe('image/png');
    expect(attachmentService.isDurablePublicUrl(row.publicUrl)).toBe(true);
    expect(fs.existsSync(path.join(attachmentService.UPLOADS_DIR, row.storageKey))).toBe(true);

    fs.unlinkSync(path.join(attachmentService.UPLOADS_DIR, row.storageKey));
  });

  it('infers MIME type from filename when Telnyx omits content_type', () => {
    expect(attachmentService.inferMimeType('photo.jpg', null)).toBe('image/jpeg');
  });
});
