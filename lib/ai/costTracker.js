/**
 * Token pricing in microdollars (1 USD = 1_000_000 microdollars).
 * Update when provider pricing changes.
 */

const MODEL_PRICING = {
  'gemini-2.5-flash': { inputPer1M: 75_000, outputPer1M: 300_000 },
  'gemini-2.5-pro': { inputPer1M: 1_250_000, outputPer1M: 5_000_000 },
  'gpt-4o-mini': { inputPer1M: 150_000, outputPer1M: 600_000 },
  'gpt-4o': { inputPer1M: 2_500_000, outputPer1M: 10_000_000 },
  'claude-3-5-haiku-20241022': { inputPer1M: 250_000, outputPer1M: 1_250_000 },
  'claude-3-5-sonnet-20241022': { inputPer1M: 3_000_000, outputPer1M: 15_000_000 },
  noop: { inputPer1M: 0, outputPer1M: 0 },
};

function getModelPricing(model) {
  return MODEL_PRICING[model] || MODEL_PRICING['gpt-4o-mini'];
}

function calculateCostMicros(model, inputTokens = 0, outputTokens = 0) {
  const pricing = getModelPricing(model);
  const inputCost = Math.round((inputTokens / 1_000_000) * pricing.inputPer1M);
  const outputCost = Math.round((outputTokens / 1_000_000) * pricing.outputPer1M);
  return inputCost + outputCost;
}

function microsToCents(micros) {
  return Math.ceil(micros / 10_000);
}

function summarizeCosts(entries) {
  const totals = entries.reduce(
    (acc, entry) => {
      acc.inputTokens += entry.inputTokens || 0;
      acc.outputTokens += entry.outputTokens || 0;
      acc.costMicros += entry.costMicros || 0;
      acc.requests += 1;
      if (entry.status === 'error') acc.errors += 1;
      return acc;
    },
    { inputTokens: 0, outputTokens: 0, costMicros: 0, requests: 0, errors: 0 },
  );
  return {
    ...totals,
    costCents: microsToCents(totals.costMicros),
  };
}

module.exports = {
  MODEL_PRICING,
  getModelPricing,
  calculateCostMicros,
  microsToCents,
  summarizeCosts,
};
