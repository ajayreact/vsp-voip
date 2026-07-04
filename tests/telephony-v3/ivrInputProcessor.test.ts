import { describe, expect, it } from 'vitest';

const { classifyInput, processInput, INPUT_TYPE } = require('../../lib/telephony-v3/IVR/ivrInputProcessor');
const { DESTINATION_TYPE } = require('../../lib/telephony-v3/IVR/ivrConstants');

const baseMenu = {
  greeting: { text: 'Welcome' },
  digits: {
    '1': { destination: DESTINATION_TYPE.EXTENSION, extensionId: 'ext-1' },
    '2': { destination: DESTINATION_TYPE.SUBMENU, menuId: 'sales' },
    '*': { destination: DESTINATION_TYPE.REPEAT },
    '9': { destination: DESTINATION_TYPE.QUEUE, queueId: 'q-1' },
  },
  maxDigits: 3,
  operatorExtensionId: 'ext-op',
  escapeToOperator: true,
};

describe('V3 ivrInputProcessor', () => {
  it('classifies timeout', () => {
    const result = classifyInput(null, baseMenu);
    expect(result.inputType).toBe(INPUT_TYPE.TIMEOUT);
  });

  it('classifies invalid digit', () => {
    const result = classifyInput('8', baseMenu);
    expect(result.inputType).toBe(INPUT_TYPE.INVALID);
  });

  it('classifies repeat on star', () => {
    const result = classifyInput('*', baseMenu);
    expect(result.inputType).toBe(INPUT_TYPE.REPEAT);
  });

  it('classifies escape to operator', () => {
    const result = classifyInput('0', baseMenu);
    expect(result.inputType).toBe(INPUT_TYPE.ESCAPE);
  });

  it('processes single digit route', () => {
    const result = processInput({ rawInput: '1', menuNode: baseMenu });
    expect(result.action).toBe('ROUTE');
    expect(result.destination?.destination).toBe(DESTINATION_TYPE.EXTENSION);
  });

  it('processes submenu navigation', () => {
    const result = processInput({ rawInput: '2', menuNode: baseMenu });
    expect(result.action).toBe('SUBMENU');
    expect(result.menuId).toBe('sales');
  });

  it('processes invalid input action', () => {
    const result = processInput({ rawInput: '8', menuNode: baseMenu });
    expect(result.action).toBe('INVALID');
    expect(result.retry).toBe(true);
  });

  it('processes multi digit when configured', () => {
    const menu = {
      ...baseMenu,
      digits: { '123': { destination: DESTINATION_TYPE.EXTENSION, extensionId: 'ext-multi' } },
    };
    const result = processInput({ rawInput: '123', menuNode: menu });
    expect(result.action).toBe('ROUTE');
    expect(result.classified.inputType).toBe(INPUT_TYPE.MULTI);
  });
});
