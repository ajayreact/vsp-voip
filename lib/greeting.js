function shortTenantName(tenantName) {
  return tenantName.replace(/\s+Inc\.?$/i, '').trim() || tenantName;
}

function resolveGreetingMessage(template, tenantName) {
  const company = shortTenantName(tenantName);
  const fallback = `Welcome to ${company}. Please hold while we connect you.`;
  if (!template || !String(template).trim()) return fallback;
  return String(template)
    .replace(/\{company\}/gi, company)
    .replace(/\{tenant\}/gi, tenantName)
    .trim();
}

module.exports = { shortTenantName, resolveGreetingMessage };
