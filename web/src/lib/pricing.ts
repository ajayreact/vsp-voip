export type BillingConfig = {
  platformFeeSetup: number;
  platformFeeMonthly: number;
  platformFeeFirstMonth: number;
  currency: string;
  stripeEnabled: boolean;
};

export type CartPricing = BillingConfig & {
  count: number;
  carrierUpfront: number;
  carrierMonthly: number;
  platformUpfront: number;
  platformFirstMonth: number;
  platformRecurring: number;
  platformFee: number;
  dueToday: number;
  recurringMonthly: number;
  orderTotal: number;
};

export function formatPrice(amount: string | number | null | undefined, currency = 'USD') {
  if (amount == null || amount === '') return '—';
  const n = Number(amount);
  if (Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
}

export function sumCarrierPrices(items: Array<{ upfrontCost: string | null; monthlyCost: string | null }>) {
  let upfront = 0;
  let monthly = 0;
  for (const item of items) {
    upfront += Number(item.upfrontCost) || 0;
    monthly += Number(item.monthlyCost) || 0;
  }
  return { upfront, monthly };
}

export function calculateTenantPricing(
  items: Array<{ upfrontCost: string | null; monthlyCost: string | null }>,
  config: BillingConfig,
): CartPricing {
  const count = items.length;
  const carrier = sumCarrierPrices(items);
  const platformUpfront = config.platformFeeSetup * count;
  const platformFirstMonth = config.platformFeeFirstMonth * count;
  const platformRecurring = config.platformFeeMonthly * count;
  const dueToday = carrier.upfront + carrier.monthly + platformUpfront + platformFirstMonth;
  const recurringMonthly = carrier.monthly + platformRecurring;

  return {
    ...config,
    count,
    carrierUpfront: carrier.upfront,
    carrierMonthly: carrier.monthly,
    platformUpfront,
    platformFirstMonth,
    platformRecurring,
    platformFee: platformUpfront + platformFirstMonth,
    dueToday,
    recurringMonthly,
    orderTotal: dueToday,
  };
}

export function perNumberPricing(
  upfront: string | null,
  monthly: string | null,
  config: BillingConfig,
) {
  const carrierUpfront = Number(upfront) || 0;
  const carrierMonthly = Number(monthly) || 0;
  const dueToday =
    carrierUpfront + carrierMonthly + config.platformFeeSetup + config.platformFeeFirstMonth;
  const recurringMonthly = carrierMonthly + config.platformFeeMonthly;
  return { dueToday, recurringMonthly };
}
