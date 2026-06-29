const assistantEngine = require('./assistantEngine');
const intents = require('./intents');
const searchService = require('./searchService');
const queryCache = require('./queryCache');
const responseParser = require('./responseParser');
const contextBuilder = require('./contextBuilder');

module.exports = {
  ...assistantEngine,
  ...intents,
  ...searchService,
  ...queryCache,
  ...responseParser,
  ...contextBuilder,
};
