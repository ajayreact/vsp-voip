const voicemailSummary = require('./voicemailSummary');
const callSummary = require('./callSummary');
const messageSummary = require('./messageSummary');
const summaryEngine = require('./summaryEngine');
const summaryStore = require('./summaryStore');
const summaryQueue = require('./summaryQueue');
const structuredOutput = require('./structuredOutput');

module.exports = {
  ...voicemailSummary,
  ...callSummary,
  ...messageSummary,
  ...summaryEngine,
  ...summaryStore,
  ...summaryQueue,
  ...structuredOutput,
};
