function parseRegion(item) {
  const regions = Array.isArray(item.region_information) ? item.region_information : [];
  const byType = (type) => regions.find((r) => r.region_type === type)?.region_name;

  return {
    locality: byType('location') || byType('locality') || item.locality || '—',
    state: byType('state') || byType('administrative_area') || '—',
    country: byType('country_code') || item.iso_country || '—',
  };
}

function buildTelnyxSearchParams(query) {
  const {
    country = 'US',
    searchBy = 'area_code',
    searchValue,
    areaCode,
    phoneNumberType,
    features,
    patternType,
    patternValue,
    contains,
    consecutive,
    limit = '50',
    bestEffort,
    quickship,
    reservable,
    excludeHeldNumbers,
  } = query;

  const params = new URLSearchParams();
  params.set('filter[country_code]', String(country).toUpperCase());
  params.set('page[size]', String(Math.min(Number(limit) || 50, 100)));

  const value = String(searchValue || areaCode || '').trim();
  const digits = String(patternValue || contains || '').trim();
  const matchType = patternType || (contains ? 'contains' : '');

  switch (searchBy) {
    case 'locality':
      if (value) params.set('filter[locality]', value);
      break;
    case 'state':
      if (value) params.set('filter[administrative_area]', value.toUpperCase());
      break;
    case 'area_code':
    default:
      if (value) params.set('filter[national_destination_code]', value);
      break;
  }

  if (phoneNumberType) {
    params.set('filter[phone_number_type]', phoneNumberType);
  }

  if (features) {
    String(features)
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean)
      .forEach((feature) => params.append('filter[features]', feature));
  }

  if (digits && matchType) {
    if (matchType === 'starts_with') {
      params.set('filter[phone_number][starts_with]', digits);
    } else if (matchType === 'ends_with') {
      params.set('filter[phone_number][ends_with]', digits);
    } else if (matchType === 'contains') {
      params.set('filter[phone_number][contains]', digits);
      if (searchBy === 'area_code' && value) {
        params.set('filter[national_destination_code]', value);
      }
    }
  }

  if (consecutive) {
    params.set('filter[consecutive]', String(consecutive));
  }

  if (bestEffort !== undefined) params.set('filter[best_effort]', String(bestEffort === 'true'));
  if (quickship !== undefined) params.set('filter[quickship]', String(quickship === 'true'));
  if (reservable !== undefined) params.set('filter[reservable]', String(reservable === 'true'));
  if (excludeHeldNumbers !== undefined) {
    params.set('filter[exclude_held_numbers]', String(excludeHeldNumbers === 'true'));
  }

  return params;
}

function mapAvailableNumber(item) {
  const region = parseRegion(item);
  const features = Array.isArray(item.features)
    ? item.features.map((f) => (typeof f === 'string' ? f : f.name)).filter(Boolean)
    : [];

  return {
    phoneNumber: item.phone_number,
    locality: region.locality,
    state: region.state,
    country: region.country,
    phoneNumberType: item.phone_number_type || item.number_type || '—',
    features,
    upfrontCost: item.cost_information?.upfront_cost ?? null,
    monthlyCost: item.cost_information?.monthly_cost ?? null,
    currency: item.cost_information?.currency ?? 'USD',
  };
}

module.exports = { buildTelnyxSearchParams, mapAvailableNumber };
