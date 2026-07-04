const { INPUT_TYPE, DESTINATION_TYPE } = require('./ivrConstants');
const { resolveDigitDestination } = require('./ivrMenuResolver');

/**
 * Classify raw DTMF input.
 *
 * @param {string|null|undefined} rawInput
 * @param {Record<string, unknown>} menuNode
 */
function classifyInput(rawInput, menuNode) {
  if (rawInput == null || rawInput === '') {
    return { inputType: INPUT_TYPE.TIMEOUT, digit: null };
  }

  const input = String(rawInput).trim();

  if (input === '#') {
    return { inputType: INPUT_TYPE.HASH, digit: '#', normalized: input };
  }
  if (input === '*') {
    const starDest = resolveDigitDestination(menuNode, '*');
    if (starDest?.destination === DESTINATION_TYPE.REPEAT) {
      return { inputType: INPUT_TYPE.REPEAT, digit: '*', normalized: input, destination: starDest };
    }
    return { inputType: INPUT_TYPE.STAR, digit: '*', normalized: input };
  }
  if (input === '**' || input.toLowerCase() === 'repeat') {
    return { inputType: INPUT_TYPE.REPEAT, digit: '*', normalized: input };
  }
  if (input === '0' && menuNode?.escapeToOperator) {
    return { inputType: INPUT_TYPE.ESCAPE, digit: '0', normalized: input };
  }

  const maxDigits = menuNode?.maxDigits ?? 1;
  if (input.length > 1 && maxDigits > 1) {
    const dest = resolveDigitDestination(menuNode, input);
    if (dest) {
      return { inputType: INPUT_TYPE.MULTI, digit: input, normalized: input, destination: dest };
    }
  }

  const single = input.length === 1 ? input : input.slice(-1);
  const dest = resolveDigitDestination(menuNode, single);
  if (!dest && input !== single) {
    const multiDest = resolveDigitDestination(menuNode, input);
    if (multiDest) {
      return { inputType: INPUT_TYPE.MULTI, digit: input, normalized: input, destination: multiDest };
    }
  }

  if (!dest) {
    return { inputType: INPUT_TYPE.INVALID, digit: single, normalized: input };
  }

  if (dest.destination === DESTINATION_TYPE.REPEAT || single === '*') {
    return { inputType: INPUT_TYPE.REPEAT, digit: single, normalized: single, destination: dest };
  }

  return {
    inputType: maxDigits > 1 && input.length > 1 ? INPUT_TYPE.MULTI : INPUT_TYPE.SINGLE,
    digit: single,
    normalized: input,
    destination: dest,
  };
}

/**
 * Process classified input into routing decision.
 *
 * @param {{
 *   rawInput?: string|null,
 *   menuNode: Record<string, unknown>,
 *   ivr?: Record<string, unknown>,
 * }} input
 */
function processInput(input) {
  const classified = classifyInput(input.rawInput, input.menuNode);

  if (classified.inputType === INPUT_TYPE.TIMEOUT) {
    return { action: 'TIMEOUT', classified, retry: true };
  }
  if (classified.inputType === INPUT_TYPE.INVALID) {
    return { action: 'INVALID', classified, retry: true };
  }
  if (classified.inputType === INPUT_TYPE.REPEAT) {
    return {
      action: 'REPEAT',
      classified,
      destination: { destination: DESTINATION_TYPE.REPEAT },
    };
  }
  if (classified.inputType === INPUT_TYPE.ESCAPE) {
    return {
      action: 'ROUTE',
      classified,
      destination: {
        destination: DESTINATION_TYPE.OPERATOR,
        extensionId: input.menuNode?.operatorExtensionId,
      },
    };
  }

  const dest = classified.destination || resolveDigitDestination(input.menuNode, classified.digit);
  if (!dest) {
    return { action: 'INVALID', classified, retry: true };
  }

  if (dest.destination === DESTINATION_TYPE.SUBMENU) {
    return { action: 'SUBMENU', classified, destination: dest, menuId: dest.menuId || dest.submenuId };
  }

  return { action: 'ROUTE', classified, destination: dest };
}

module.exports = {
  classifyInput,
  processInput,
  INPUT_TYPE,
};
