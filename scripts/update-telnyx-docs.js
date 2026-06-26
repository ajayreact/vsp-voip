#!/usr/bin/env node
/**
 * VSP Phone — Telnyx Knowledge Base sync
 *
 * Downloads Telnyx documentation relevant to the VSP stack, organizes it under
 * docs/telnyx/, and rebuilds docs/telnyx/search-index.json.
 *
 * Usage:
 *   node scripts/update-telnyx-docs.js
 *   node scripts/update-telnyx-docs.js --dry-run
 *   node scripts/update-telnyx-docs.js --verbose
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const DOCS_ROOT = path.join(REPO_ROOT, 'docs', 'telnyx');
const CONFIG_PATH = path.join(DOCS_ROOT, '.telnyx-docs-config.json');
const MANIFEST_PATH = path.join(DOCS_ROOT, '.telnyx-docs-manifest.json');
const INDEX_PATH = path.join(DOCS_ROOT, 'search-index.json');
const REPORT_PATH = path.join(DOCS_ROOT, 'VALIDATION-REPORT.md');

const FETCH_TIMEOUT_MS = 30000;
const FETCH_DELAY_MS = 120;

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');

function log(...parts) {
  console.log('[telnyx-docs]', ...parts);
}

function verbose(...parts) {
  if (VERBOSE) console.log('[telnyx-docs:verbose]', ...parts);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sha256(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

function slugify(text) {
  return String(text || 'untitled')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'untitled';
}

function loadJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

async function fetchText(url, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'text/markdown, text/plain, */*',
          'User-Agent': 'VSP-Phone-Telnyx-KB/1.0 (+https://vspphone.com)',
        },
      });
      clearTimeout(timer);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.text();
    } catch (err) {
      clearTimeout(timer);
      if (attempt >= retries) throw err;
      await sleep(500 * (attempt + 1));
    }
  }
  throw new Error('unreachable');
}

function shouldInclude(url, config) {
  const lower = url.toLowerCase();
  if (!lower.includes('developers.telnyx.com')) return false;
  for (const pattern of config.excludeUrlPatterns) {
    if (lower.includes(pattern.toLowerCase())) return false;
  }
  for (const pattern of config.includeUrlPatterns) {
    if (lower.includes(pattern.toLowerCase())) return true;
  }
  return false;
}

function mapCategory(url) {
  const u = url.toLowerCase();
  if (u.includes('/development/webrtc/js-sdk/')) return 'javascript-sdk';
  if (u.includes('/development/webrtc/flutter-sdk')) return 'javascript-sdk';
  if (u.includes('/docs/voice/webrtc/')) return 'webrtc';
  if (u.includes('transfer')) return 'transfers';
  if (u.includes('conference')) return 'conferences';
  if (u.includes('voicemail')) return 'voicemail';
  if (u.includes('recording')) return 'recordings';
  if (u.includes('/messaging/') || u.includes('/api-reference/messaging')) return 'messaging';
  if (u.includes('/numbers/') || u.includes('/api-reference/phone-numbers') || u.includes('/api-reference/number-')) return 'phone-numbers';
  if (u.includes('/sip') || u.includes('credential-connection') || u.includes('/connections/') || u.includes('uac')) return 'sip';
  if (u.includes('webhook')) return 'webhooks';
  if (u.includes('/auth/') || u.includes('credential') || u.includes('access-token') || u.includes('apis-fundamentals')) return 'authentication';
  if (u.includes('changelog')) return 'changelog';
  if (u.includes('error') || u.includes('warning') || u.includes('troubleshoot')) return 'error-codes';
  if (u.includes('best-practice') || u.includes('production') || u.includes('fundamentals')) return 'best-practices';
  return 'call-control';
}

function localPathFor(url, title) {
  const parsed = new URL(url);
  let rel = parsed.pathname.replace(/^\/+/, '');
  if (rel.endsWith('.md')) rel = rel.slice(0, -3);
  rel = rel.replace(/\//g, path.sep);

  const category = mapCategory(url);
  const categoryRoot = path.join(DOCS_ROOT, category);

  if (rel.startsWith(`development${path.sep}webrtc${path.sep}js-sdk${path.sep}`)) {
    return path.join(categoryRoot, rel.replace(`development${path.sep}webrtc${path.sep}js-sdk${path.sep}`, ''));
  }
  if (rel.startsWith(`development${path.sep}webrtc${path.sep}flutter-sdk`)) {
    const sub = rel.replace(`development${path.sep}webrtc${path.sep}flutter-sdk`, '').replace(/^[/\\]/, '');
    return path.join(DOCS_ROOT, 'javascript-sdk', 'flutter', sub);
  }
  if (rel.startsWith(`docs${path.sep}voice${path.sep}webrtc${path.sep}`)) {
    return path.join(DOCS_ROOT, 'webrtc', rel.replace(`docs${path.sep}voice${path.sep}webrtc${path.sep}`, ''));
  }
  if (rel.startsWith(`docs${path.sep}voice${path.sep}programmable-voice${path.sep}`)) {
    return path.join(DOCS_ROOT, 'call-control', 'guides', rel.replace(`docs${path.sep}voice${path.sep}programmable-voice${path.sep}`, ''));
  }
  if (rel.startsWith(`api-reference${path.sep}`)) {
    return path.join(DOCS_ROOT, 'call-control', 'api-reference', rel.replace(`api-reference${path.sep}`, ''));
  }

  if (rel.startsWith(`docs${path.sep}voice${path.sep}sip${path.sep}`)) {
    return path.join(DOCS_ROOT, 'sip', rel.replace(`docs${path.sep}voice${path.sep}sip${path.sep}`, ''));
  }
  if (rel.startsWith(`docs${path.sep}voice${path.sep}sip-trunking${path.sep}`)) {
    return path.join(DOCS_ROOT, 'sip', rel.replace(`docs${path.sep}voice${path.sep}sip-trunking${path.sep}`, ''));
  }

  return path.join(categoryRoot, slugify(title));
}

function parseIndexEntries(markdown, sourceUrl) {
  const entries = [];
  const regex = /^-\s+\[([^\]]+)\]\((https:\/\/developers\.telnyx\.com[^)]+)\):\s*(.*)$/gm;
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    entries.push({
      title: match[1].trim(),
      url: match[2].trim(),
      summary: match[3].trim(),
      sourceIndex: sourceUrl,
    });
  }
  return entries;
}

function extractKeywords(title, summary, url, content) {
  const base = `${title} ${summary} ${url}`.toLowerCase();
  const tokens = base
    .replace(/[^a-z0-9\s/_-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
  const contentTokens = String(content || '')
    .toLowerCase()
    .slice(0, 4000)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 4)
    .slice(0, 40);
  return [...new Set([...tokens, ...contentTokens])].slice(0, 60);
}

function extractRelated(content) {
  const apis = [];
  const sdkClasses = [];
  const events = [];
  const webhooks = [];

  const apiRegex = /(?:POST|GET|PUT|PATCH|DELETE)\s+\/v2\/[^\s`'"]+/g;
  const classRegex = /\b(TelnyxRTC|Call|IClientOptions|ICallOptions|INotification|Peer)\b/g;
  const eventRegex = /\b(call\.[a-z0-9_.-]+|telnyx\.[a-z0-9_.-]+)\b/gi;
  const webhookRegex = /\b(call\.[a-z0-9_.-]+)\b/gi;

  let m;
  const text = String(content || '');
  while ((m = apiRegex.exec(text)) !== null) apis.push(m[0]);
  while ((m = classRegex.exec(text)) !== null) sdkClasses.push(m[1]);
  while ((m = eventRegex.exec(text)) !== null) events.push(m[1]);
  while ((m = webhookRegex.exec(text)) !== null) webhooks.push(m[1]);

  return {
    relatedApis: [...new Set(apis)].slice(0, 20),
    relatedSdkClasses: [...new Set(sdkClasses)].slice(0, 20),
    relatedEvents: [...new Set(events)].slice(0, 30),
    relatedWebhooks: [...new Set(webhooks)].slice(0, 30),
    relatedExamples: [],
  };
}

function buildIndexRecord(meta) {
  const related = extractRelated(meta.content);
  return {
    id: meta.id,
    title: meta.title,
    summary: meta.summary,
    keywords: extractKeywords(meta.title, meta.summary, meta.url, meta.content),
    category: meta.category,
    sourceUrl: meta.url,
    localPath: path.relative(REPO_ROOT, meta.localPath).replace(/\\/g, '/'),
    relatedApis: related.relatedApis,
    relatedSdkClasses: related.relatedSdkClasses,
    relatedEvents: related.relatedEvents,
    relatedWebhooks: related.relatedWebhooks,
    relatedExamples: related.relatedExamples,
    contentHash: meta.hash,
    updatedAt: meta.updatedAt,
  };
}

function writeFrontmatter(meta) {
  const fm = [
    '---',
    `title: "${meta.title.replace(/"/g, '\\"')}"`,
    `source_url: "${meta.url}"`,
    `category: "${meta.category}"`,
    `synced_at: "${meta.updatedAt}"`,
    `content_hash: "${meta.hash}"`,
    '---',
    '',
  ].join('\n');
  return fm + String(meta.content || '').trim() + '\n';
}

function categoryStats(indexRecords) {
  const stats = {};
  for (const row of indexRecords) {
    stats[row.category] = (stats[row.category] || 0) + 1;
  }
  return stats;
}

function writeValidationReport(summary) {
  const lines = [
    '# VSP Phone Telnyx Knowledge Base — Validation Report',
    '',
    `Generated: ${summary.generatedAt}`,
    '',
    '## Summary',
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total documents on disk | ${summary.totalDocuments} |`,
    `| Total indexed pages | ${summary.totalIndexed} |`,
    `| Added this run | ${summary.added.length} |`,
    `| Updated this run | ${summary.updated.length} |`,
    `| Unchanged (skipped) | ${summary.unchanged.length} |`,
    `| Removed (stale) | ${summary.removed.length} |`,
    `| Failed downloads | ${summary.failed.length} |`,
    `| Sync duration (ms) | ${summary.durationMs} |`,
    '',
    '## Documentation categories',
    '',
    '| Category | Pages |',
    '|----------|-------|',
  ];

  for (const [cat, count] of Object.entries(summary.categoryStats).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${cat} | ${count} |`);
  }

  lines.push('', '## Excluded technologies', '');
  for (const tech of summary.excludedTechnologies) {
    lines.push(`- ${tech}`);
  }

  lines.push('', '## Search index', '');
  lines.push(`- Index file: \`docs/telnyx/search-index.json\``);
  lines.push(`- Manifest file: \`docs/telnyx/.telnyx-docs-manifest.json\``);
  lines.push(`- Average keywords per page: ${summary.avgKeywords}`);
  lines.push(`- Search performance: in-repo full-text via Cursor \`docs/telnyx/**\` (${summary.totalIndexed} pages, ~${summary.indexSizeKb} KB index)`);

  lines.push('', '## Refresh script validation', '');
  lines.push('- [x] Downloads from Telnyx official llms.txt section indices');
  lines.push('- [x] Filters to VSP-relevant JavaScript/TypeScript + Flutter docs only');
  lines.push('- [x] Preserves folder structure under `docs/telnyx/`');
  lines.push('- [x] Skips unchanged documents via SHA-256 hash');
  lines.push('- [x] Updates searchable JSON index with metadata');
  lines.push('- [x] Produces add/update/remove summary');

  if (summary.failed.length) {
    lines.push('', '## Failed downloads', '');
    for (const f of summary.failed) {
      lines.push(`- ${f.url} — ${f.error}`);
    }
  }

  if (summary.added.length) {
    lines.push('', '## Added files', '');
    for (const f of summary.added.slice(0, 50)) lines.push(`- ${f}`);
    if (summary.added.length > 50) lines.push(`- … and ${summary.added.length - 50} more`);
  }

  fs.writeFileSync(REPORT_PATH, lines.join('\n') + '\n', 'utf8');
}

async function main() {
  const started = Date.now();
  const config = loadJson(CONFIG_PATH, null);
  if (!config) {
    console.error('Missing config:', CONFIG_PATH);
    process.exit(1);
  }

  ensureDir(DOCS_ROOT);
  for (const dir of [
    'javascript-sdk', 'webrtc', 'call-control', 'phone-numbers', 'sip',
    'recordings', 'voicemail', 'conferences', 'transfers', 'messaging',
    'webhooks', 'authentication', 'error-codes', 'best-practices', 'changelog',
  ]) {
    ensureDir(path.join(DOCS_ROOT, dir));
  }

  const manifest = loadJson(MANIFEST_PATH, { files: {} });
  const previousPaths = new Set(Object.keys(manifest.files || {}));

  log('Fetching Telnyx section indices…');
  const allEntries = [];
  for (const sectionUrl of config.sectionIndices) {
    try {
      const text = await fetchText(sectionUrl);
      const entries = parseIndexEntries(text, sectionUrl);
      verbose(sectionUrl, `→ ${entries.length} links`);
      allEntries.push(...entries);
      await sleep(FETCH_DELAY_MS);
    } catch (err) {
      log('WARN: failed section index', sectionUrl, err.message);
    }
  }

  const deduped = new Map();
  for (const entry of allEntries) {
    if (!shouldInclude(entry.url, config)) continue;
    if (!deduped.has(entry.url)) deduped.set(entry.url, entry);
  }

  log(`Discovered ${deduped.size} relevant pages (from ${allEntries.length} total links)`);

  const added = [];
  const updated = [];
  const unchanged = [];
  const failed = [];
  const indexRecords = [];
  const currentPaths = new Set();

  let i = 0;
  for (const entry of deduped.values()) {
    i += 1;
    const localPath = localPathFor(entry.url, entry.title) + '.md';
    const relPath = path.relative(DOCS_ROOT, localPath).replace(/\\/g, '/');
    currentPaths.add(relPath);
    const id = slugify(entry.title) + '-' + sha256(entry.url).slice(0, 8);

    let content;
    try {
      content = await fetchText(entry.url);
    } catch (err) {
      failed.push({ url: entry.url, error: err.message });
      log(`FAIL [${i}/${deduped.size}]`, entry.title, err.message);
      continue;
    }

    const hash = sha256(content);
    const prev = manifest.files[relPath];
    const category = mapCategory(entry.url);
    const updatedAt = new Date().toISOString();

    if (prev && prev.hash === hash && fs.existsSync(localPath)) {
      unchanged.push(relPath);
      indexRecords.push(buildIndexRecord({
        id,
        title: entry.title,
        summary: entry.summary,
        url: entry.url,
        category,
        localPath,
        content,
        hash,
        updatedAt: prev.updatedAt || updatedAt,
      }));
      verbose('skip', relPath);
    } else {
      if (!DRY_RUN) {
        ensureDir(path.dirname(localPath));
        fs.writeFileSync(localPath, writeFrontmatter({
          title: entry.title,
          url: entry.url,
          category,
          hash,
          updatedAt,
          content,
        }), 'utf8');
      }
      if (prev) updated.push(relPath);
      else added.push(relPath);
      manifest.files[relPath] = { hash, url: entry.url, title: entry.title, updatedAt, category };
      indexRecords.push(buildIndexRecord({
        id,
        title: entry.title,
        summary: entry.summary,
        url: entry.url,
        category,
        localPath,
        content,
        hash,
        updatedAt,
      }));
      log(`${prev ? 'UPDATE' : 'ADD  '} [${i}/${deduped.size}]`, relPath);
    }

    await sleep(FETCH_DELAY_MS);
  }

  const removed = [...previousPaths].filter((p) => !currentPaths.has(p));
  for (const relPath of removed) {
    const full = path.join(DOCS_ROOT, relPath);
    if (!DRY_RUN && fs.existsSync(full)) fs.unlinkSync(full);
    delete manifest.files[relPath];
    log('REMOVE', relPath);
  }

  indexRecords.sort((a, b) => a.title.localeCompare(b.title));

  const indexPayload = {
    generatedAt: new Date().toISOString(),
    version: 1,
    totalPages: indexRecords.length,
    categories: categoryStats(indexRecords),
    pages: indexRecords,
  };

  if (!DRY_RUN) {
    fs.writeFileSync(INDEX_PATH, JSON.stringify(indexPayload, null, 2) + '\n', 'utf8');
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify({
      lastSync: new Date().toISOString(),
      files: manifest.files,
    }, null, 2) + '\n', 'utf8');
  }

  const avgKeywords = indexRecords.length
    ? (indexRecords.reduce((sum, r) => sum + r.keywords.length, 0) / indexRecords.length).toFixed(1)
    : '0';

  const summary = {
    generatedAt: new Date().toISOString(),
    totalDocuments: currentPaths.size,
    totalIndexed: indexRecords.length,
    added,
    updated,
    unchanged,
    removed,
    failed,
    durationMs: Date.now() - started,
    categoryStats: categoryStats(indexRecords),
    excludedTechnologies: config.excludedTechnologies,
    avgKeywords,
    indexSizeKb: DRY_RUN ? 0 : Math.round(fs.statSync(INDEX_PATH).size / 1024),
  };

  if (!DRY_RUN) writeValidationReport(summary);

  log('Done.', {
    added: added.length,
    updated: updated.length,
    unchanged: unchanged.length,
    removed: removed.length,
    failed: failed.length,
    indexed: indexRecords.length,
    ms: summary.durationMs,
  });

  if (failed.length) process.exit(2);
}

main().catch((err) => {
  console.error('[telnyx-docs] Fatal:', err);
  process.exit(1);
});
