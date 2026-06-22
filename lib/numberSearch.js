const axios = require('axios');
const { buildTelnyxSearchParams, mapAvailableNumber } = require('./telnyxNumbers');
const { getAreaCodesForCountry } = require('./usAreaCodes');
const { logger } = require('./logger');

const TELNYX_API_KEY = process.env.TELNYX_API_KEY?.trim();

async function searchAvailableNumbers(query) {
  const telnyxParams = buildTelnyxSearchParams(query);
  logger.info('telnyx_number_search', { filters: Object.fromEntries(telnyxParams.entries()) });

  const response = await axios.get('https://api.telnyx.com/v2/available_phone_numbers', {
    headers: {
      Authorization: `Bearer ${TELNYX_API_KEY}`,
      Accept: 'application/json',
    },
    params: telnyxParams,
  });

  const numbers = (response.data.data || []).map(mapAvailableNumber);
  return {
    count: numbers.length,
    availableNumbers: numbers,
    filters: Object.fromEntries(telnyxParams.entries()),
  };
}

function listAreaCodes(country = 'US') {
  const areaCodes = getAreaCodesForCountry(String(country).toUpperCase());
  return { count: areaCodes.length, areaCodes };
}

module.exports = {
  searchAvailableNumbers,
  listAreaCodes,
};
