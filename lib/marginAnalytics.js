function toMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

function buildMarginSnapshot({ item, rates, orderId, source }) {
  const telnyxUpfront = Number(item?.upfrontCost) || 0;
  const telnyxMonthly = Number(item?.monthlyCost) || 0;
  const platformSetup = rates.platformFeeSetup;
  const platformFirstMonth = rates.platformFeeFirstMonth;
  const platformMonthly = rates.platformFeeMonthly;

  const customerPriceTotal = toMoney(
    telnyxUpfront + telnyxMonthly + platformSetup + platformFirstMonth,
  );
  const customerPriceMonthly = toMoney(telnyxMonthly + platformMonthly);
  const grossProfitUpfront = toMoney(platformSetup + platformFirstMonth);
  const grossProfitMonthly = toMoney(platformMonthly);

  return {
    orderId: orderId || null,
    source: source || null,
    telnyxUpfrontCost: toMoney(telnyxUpfront),
    telnyxMonthlyCost: toMoney(telnyxMonthly),
    platformSetupFee: toMoney(platformSetup),
    platformFirstMonthFee: toMoney(platformFirstMonth),
    platformMonthlyFee: toMoney(platformMonthly),
    customerPriceTotal,
    customerPriceMonthly,
    grossProfitUpfront,
    grossProfitMonthly,
    carrierMonthly: toMoney(telnyxMonthly),
    platformMonthly: toMoney(platformMonthly),
    tenantMonthlyTotal: customerPriceMonthly,
  };
}

function buildMarginFromOrderSplit({ order, rates, phoneNumber, source }) {
  const phoneNumbers = Array.isArray(order.phoneNumbers) ? order.phoneNumbers : [];
  const count = Math.max(1, phoneNumbers.length);
  const perCarrierUpfront = Number(order.carrierUpfront) / count;
  const perCarrierMonthly = Number(order.carrierMonthly) / count;

  return buildMarginSnapshot({
    item: {
      phoneNumber,
      upfrontCost: String(perCarrierUpfront),
      monthlyCost: String(perCarrierMonthly),
    },
    rates,
    orderId: order.id,
    source,
  });
}

async function applyMarginToPhoneNumber(prisma, phoneNumberId, margin) {
  if (!phoneNumberId || !margin) return null;
  return prisma.phoneNumber.update({
    where: { id: phoneNumberId },
    data: {
      orderId: margin.orderId,
      source: margin.source,
      telnyxUpfrontCost: margin.telnyxUpfrontCost,
      telnyxMonthlyCost: margin.telnyxMonthlyCost,
      platformSetupFee: margin.platformSetupFee,
      platformFirstMonthFee: margin.platformFirstMonthFee,
      platformMonthlyFee: margin.platformMonthlyFee,
      customerPriceTotal: margin.customerPriceTotal,
      customerPriceMonthly: margin.customerPriceMonthly,
      grossProfitUpfront: margin.grossProfitUpfront,
      grossProfitMonthly: margin.grossProfitMonthly,
      carrierMonthly: margin.carrierMonthly,
      platformMonthly: margin.platformMonthly,
      tenantMonthlyTotal: margin.tenantMonthlyTotal,
    },
  });
}

module.exports = {
  buildMarginSnapshot,
  buildMarginFromOrderSplit,
  applyMarginToPhoneNumber,
};
