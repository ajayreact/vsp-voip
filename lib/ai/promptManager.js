const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROMPTS_DIR = path.join(__dirname, 'prompts');
const LEGACY_PROMPTS = new Map();

const BUILTIN_PROMPTS = {
  'system.enterprise_assistant': `You are VSP Phone enterprise assistant for {{tenantName}}.
Follow company policies. Do not request or store credentials.
Respond concisely and professionally.`,

  'module.transcription.postprocess': `Normalize the following call transcript.
Preserve speaker labels. Remove filler words sparingly.
Do not invent facts not present in the transcript.

Transcript:
{{transcript}}`,
};

/** @type {Map<string, Map<number, object>>} */
const VERSION_REGISTRY = new Map();

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { meta: {}, body: raw.trim() };
  }

  const meta = {};
  for (const line of match[1].split('\n')) {
    const parts = line.split(':');
    if (parts.length < 2) continue;
    const key = parts[0].trim();
    const value = parts.slice(1).join(':').trim();
    if (key === 'version') meta.version = Number.parseInt(value, 10);
    else meta[key] = value;
  }

  return { meta, body: match[2].trim() };
}

function registerVersionedPrompt(record) {
  const name = record.name;
  const version = Number(record.version);
  if (!name || !Number.isFinite(version)) return;

  if (!VERSION_REGISTRY.has(name)) {
    VERSION_REGISTRY.set(name, new Map());
  }

  const versions = VERSION_REGISTRY.get(name);
  if (versions.has(version)) {
    throw new Error(`Prompt version already exists: ${name} v${version}`);
  }

  versions.set(version, record);
}

function loadPromptFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const { meta, body } = parseFrontmatter(raw);
  const fileName = path.basename(filePath, '.md');
  const fileMatch = fileName.match(/^(.*)_v(\d+)$/);

  const name = meta.name || fileMatch?.[1] || fileName;
  const version = meta.version || Number.parseInt(fileMatch?.[2] || '1', 10);
  const stat = fs.statSync(filePath);

  registerVersionedPrompt({
    name,
    version,
    template: body,
    checksum: sha256(body),
    author: meta.author || 'unknown',
    lastModified: stat.mtime.toISOString(),
    filePath,
  });
}

function bootstrapVersionedPrompts() {
  if (!fs.existsSync(PROMPTS_DIR)) return;

  const files = fs.readdirSync(PROMPTS_DIR).filter((file) => file.endsWith('.md'));
  for (const file of files.sort()) {
    loadPromptFile(path.join(PROMPTS_DIR, file));
  }
}

function registerPrompt(name, template) {
  if (!name || typeof template !== 'string') {
    throw new Error('Prompt name and template string are required');
  }
  LEGACY_PROMPTS.set(name, template);
}

function renderTemplate(template, variables = {}) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = variables[key];
    return value == null ? '' : String(value);
  });
}

function getLatestVersion(name) {
  const versions = VERSION_REGISTRY.get(name);
  if (!versions || versions.size === 0) return null;
  return Math.max(...versions.keys());
}

function getPromptRecord(name, version) {
  const versions = VERSION_REGISTRY.get(name);
  if (!versions) return null;
  return versions.get(version) || null;
}

function renderPromptVersion(name, version, variables = {}) {
  const record = getPromptRecord(name, version);
  if (!record) {
    throw new Error(`Unknown prompt version: ${name} v${version}`);
  }
  return renderTemplate(record.template, variables);
}

function renderPrompt(name, variables = {}) {
  const latest = getLatestVersion(name);
  if (latest != null) {
    return renderPromptVersion(name, latest, variables);
  }

  const legacy = LEGACY_PROMPTS.get(name) || BUILTIN_PROMPTS[name];
  if (!legacy) {
    throw new Error(`Unknown prompt template: ${name}`);
  }
  return renderTemplate(legacy, variables);
}

function listPrompts() {
  const versioned = [...VERSION_REGISTRY.keys()];
  const legacy = [...LEGACY_PROMPTS.keys(), ...Object.keys(BUILTIN_PROMPTS)];
  return [...new Set([...versioned, ...legacy])].sort();
}

function listPromptVersions(name) {
  const versions = VERSION_REGISTRY.get(name);
  if (!versions) return [];
  return [...versions.values()]
    .sort((a, b) => a.version - b.version)
    .map((record) => ({
      name: record.name,
      version: record.version,
      checksum: record.checksum,
      author: record.author,
      lastModified: record.lastModified,
    }));
}

function getPromptMetadata(name, version) {
  const resolvedVersion = version ?? getLatestVersion(name);
  if (resolvedVersion == null) return null;
  const record = getPromptRecord(name, resolvedVersion);
  if (!record) return null;
  return {
    name: record.name,
    version: record.version,
    checksum: record.checksum,
    author: record.author,
    lastModified: record.lastModified,
  };
}

function bootstrapPrompts() {
  for (const [name, template] of Object.entries(BUILTIN_PROMPTS)) {
    if (!LEGACY_PROMPTS.has(name)) registerPrompt(name, template);
  }
  bootstrapVersionedPrompts();
}

bootstrapPrompts();

module.exports = {
  registerPrompt,
  renderPrompt,
  renderPromptVersion,
  renderTemplate,
  listPrompts,
  listPromptVersions,
  getPromptMetadata,
  bootstrapPrompts,
  BUILTIN_PROMPTS,
  PROMPTS_DIR,
};
