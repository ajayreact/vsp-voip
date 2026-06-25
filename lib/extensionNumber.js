/** Strict 3-digit extension numbers (100–999), unique per tenant via DB constraint. */

const EXTENSION_MIN = 100;
const EXTENSION_MAX = 999;
const EXTENSION_PATTERN = /^[1-9]\d{2}$/;

function isValidExtensionNumber(value) {
  const num = String(value ?? '').trim();
  if (!EXTENSION_PATTERN.test(num)) return false;
  const n = Number(num);
  return n >= EXTENSION_MIN && n <= EXTENSION_MAX;
}

function normalizeExtensionNumber(value) {
  const num = String(value ?? '').trim();
  if (!num) {
    throw Object.assign(new Error('Extension number is required'), { status: 400 });
  }
  if (/\s/.test(String(value ?? ''))) {
    throw Object.assign(new Error('Extension number cannot contain spaces'), { status: 400 });
  }
  if (!/^\d+$/.test(num)) {
    throw Object.assign(new Error('Extension number must be numeric'), { status: 400 });
  }
  if (num.length !== 3) {
    throw Object.assign(new Error('Extension number must be exactly 3 digits'), { status: 400 });
  }
  if (!isValidExtensionNumber(num)) {
    throw Object.assign(
      new Error(`Extension number must be between ${EXTENSION_MIN} and ${EXTENSION_MAX}`),
      { status: 400 },
    );
  }
  return num;
}

function suggestNextExtensionNumber(usedNumbers) {
  const used = new Set(Array.isArray(usedNumbers) ? usedNumbers.map(String) : []);
  for (let n = EXTENSION_MIN; n <= EXTENSION_MAX; n += 1) {
    const candidate = String(n);
    if (!used.has(candidate)) return candidate;
  }
  throw Object.assign(new Error('No extension numbers available in range 100–999'), { status: 409 });
}

module.exports = {
  EXTENSION_MIN,
  EXTENSION_MAX,
  EXTENSION_PATTERN,
  isValidExtensionNumber,
  normalizeExtensionNumber,
  suggestNextExtensionNumber,
};
