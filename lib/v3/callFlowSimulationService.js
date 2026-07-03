/**
 * V3 Call Flow Simulation Service — design-time simulator (no live telephony).
 */

const callFlowValidationService = require('./callFlowValidationService');
const callFlowExecutionService = require('./callFlowExecutionService');
const callFlowNodeService = require('./callFlowNodeService');

async function simulateFlow(prisma, tenantId, definition, input = {}) {
  const def = callFlowNodeService.normalizeDefinition(definition);
  const validation = await callFlowValidationService.validateFlow(prisma, tenantId, def);

  const simulationInput = {
    incomingDid: input.incomingDid || input.did || null,
    currentTime: input.currentTime || new Date().toISOString(),
    businessHours: input.businessHours || null,
    holidays: input.holidays || [],
    pressedDigits: input.pressedDigits || input.digits || [],
    webhookResults: input.webhookResults || {},
  };

  const execution = callFlowExecutionService.executePath(def, simulationInput);

  const warnings = [
    ...validation.warnings.map((w) => ({ source: 'validation', ...w })),
    ...execution.warnings.map((w) => ({ source: 'simulation', ...w })),
  ];
  const errors = [
    ...validation.errors.map((e) => ({ source: 'validation', ...e })),
    ...execution.errors.map((e) => ({ source: 'simulation', ...e })),
  ];

  return {
    mode: 'simulation',
    input: simulationInput,
    validation: {
      valid: validation.valid,
      scanned: validation.scanned,
    },
    executionPath: execution.path,
    finalDestination: execution.finalDestination,
    ok: validation.valid && execution.ok,
    warnings,
    errors,
  };
}

module.exports = { simulateFlow };
