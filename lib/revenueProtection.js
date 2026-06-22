const axios = require('axios');
const { normalizePhoneNumber } = require('./phone');

function telnyxHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/json',
  };
}

async function listAllTelnyxNumbers(apiKey) {
  if (!apiKey?.trim()) return [];

  const numbers = new Set();
  let page = 1;

  while (true) {
    const response = await axios.get('https://api.telnyx.com/v2/phone_numbers', {
      headers: telnyxHeaders(apiKey),
      params: { 'page[number]': page, 'page[size]': 250 },
      timeout: 20000,
    });

    const rows = response.data.data || [];
    for (const row of rows) {
      const num = normalizePhoneNumber(row.phone_number);
      if (num) numbers.add(num);
    }

    const totalPages = response.data.meta?.total_pages ?? 1;
    if (page >= totalPages || !rows.length) break;
    page += 1;
  }

  return [...numbers];
}

async function getRevenueProtectionDashboard(prisma) {
  const [
    paidOrders,
    pendingPayments,
    unpaidFulfillments,
    numbersWithoutInvoice,
    marginAgg,
    monthlyMrrAgg,
    carrierCostAgg,
    grossProfitAgg,
    marginByTenant,
    recentAlerts,
  ] = await Promise.all([
    prisma.numberOrder.count({
      where: {
        OR: [
          { paymentMethod: 'STRIPE', status: { in: ['FULFILLED', 'PARTIAL', 'PAID'] } },
          { paymentMethod: 'MANUAL_BANK', paymentReviewStatus: 'APPROVED' },
          { paymentMethod: 'RAZORPAY', invoicePaidAt: { not: null } },
        ],
      },
    }),
    prisma.numberOrder.count({
      where: {
        status: { in: ['PENDING', 'PENDING_PAYMENT'] },
        paymentMethod: 'MANUAL_BANK',
      },
    }),
    prisma.numberOrder.count({
      where: {
        status: { in: ['FULFILLED', 'PARTIAL'] },
        paymentMethod: 'MANUAL_BANK',
        paymentReviewStatus: { not: 'APPROVED' },
        paymentReference: { not: 'ADMIN_DIRECT' },
      },
    }),
    prisma.phoneNumber.count({
      where: {
        isActive: true,
        OR: [
          { orderId: null },
          { source: 'ADMIN_ASSIGN' },
          {
            order: {
              billTenantAutomatically: true,
              receivable: { status: 'PENDING' },
            },
          },
        ],
      },
    }),
    prisma.phoneNumber.aggregate({
      where: { isActive: true, grossProfitUpfront: { not: null } },
      _sum: {
        grossProfitUpfront: true,
        grossProfitMonthly: true,
        customerPriceTotal: true,
        customerPriceMonthly: true,
        telnyxUpfrontCost: true,
        telnyxMonthlyCost: true,
      },
      _count: true,
    }),
    prisma.phoneNumber.aggregate({
      where: { isActive: true },
      _sum: { customerPriceMonthly: true, tenantMonthlyTotal: true },
    }),
    prisma.phoneNumber.aggregate({
      where: { isActive: true },
      _sum: { telnyxMonthlyCost: true, telnyxUpfrontCost: true },
    }),
    prisma.phoneNumber.aggregate({
      where: { isActive: true },
      _sum: { grossProfitMonthly: true, grossProfitUpfront: true },
    }),
    prisma.phoneNumber.groupBy({
      by: ['tenantId'],
      where: { isActive: true, grossProfitMonthly: { not: null } },
      _sum: {
        grossProfitMonthly: true,
        grossProfitUpfront: true,
        customerPriceMonthly: true,
        telnyxMonthlyCost: true,
      },
      _count: { _all: true },
    }),
    prisma.billingIntegrityAlert.findMany({
      where: { resolvedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  const tenantIds = marginByTenant.map((r) => r.tenantId);
  const tenants = tenantIds.length
    ? await prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, name: true },
    })
    : [];
  const tenantNameById = Object.fromEntries(tenants.map((t) => [t.id, t.name]));

  return {
    paidOrders,
    pendingPayments,
    unpaidFulfillments,
    numbersWithoutInvoice,
    marginNumbersTracked: marginAgg._count,
    totals: {
      upfrontGrossProfit: Number(marginAgg._sum.grossProfitUpfront || 0),
      monthlyGrossProfit: Number(marginAgg._sum.grossProfitMonthly || 0),
      monthlyMrr: Number(monthlyMrrAgg._sum.customerPriceMonthly || monthlyMrrAgg._sum.tenantMonthlyTotal || 0),
      carrierMonthlyCost: Number(carrierCostAgg._sum.telnyxMonthlyCost || 0),
      carrierUpfrontCost: Number(carrierCostAgg._sum.telnyxUpfrontCost || 0),
      grossProfitMonthly: Number(grossProfitAgg._sum.grossProfitMonthly || 0),
    },
    marginByTenant: marginByTenant.map((row) => ({
      tenantId: row.tenantId,
      tenantName: tenantNameById[row.tenantId] || row.tenantId,
      numberCount: row._count._all,
      monthlyGrossProfit: Number(row._sum.grossProfitMonthly || 0),
      upfrontGrossProfit: Number(row._sum.grossProfitUpfront || 0),
      customerMrr: Number(row._sum.customerPriceMonthly || 0),
      carrierMonthlyCost: Number(row._sum.telnyxMonthlyCost || 0),
    })),
    recentAlerts,
  };
}

async function runBillingIntegrityChecks(prisma, { apiKey } = {}) {
  const alerts = [];
  const telnyxKey = apiKey || process.env.TELNYX_API_KEY?.trim();

  const activeNumbers = await prisma.phoneNumber.findMany({
    where: { isActive: true },
    include: {
      order: {
        include: { receivable: true },
      },
    },
  });

  for (const num of activeNumbers) {
    const paidOrder = num.order && (
      (num.order.paymentMethod === 'STRIPE' && ['FULFILLED', 'PARTIAL', 'PAID'].includes(num.order.status))
      || (num.order.paymentMethod === 'MANUAL_BANK' && num.order.paymentReviewStatus === 'APPROVED')
      || (num.order.paymentMethod === 'RAZORPAY' && num.order.invoicePaidAt)
      || num.order.paymentReference === 'ADMIN_DIRECT_BILLABLE'
    );

    if (!paidOrder && num.source !== 'ADMIN_ASSIGN') {
      alerts.push({
        type: 'NUMBER_WITHOUT_PAID_ORDER',
        severity: 'critical',
        message: `Number ${num.number} is active without a paid/approved order`,
        details: { phoneNumberId: num.id, tenantId: num.tenantId, orderId: num.orderId, source: num.source },
      });
    }
  }

  if (telnyxKey) {
    try {
      const telnyxNumbers = await listAllTelnyxNumbers(telnyxKey);
      const telnyxSet = new Set(telnyxNumbers);
      const dbSet = new Set(activeNumbers.map((n) => n.number));

      for (const telnyxNum of telnyxNumbers) {
        if (!dbSet.has(telnyxNum)) {
          alerts.push({
            type: 'TELNYX_NOT_IN_DB',
            severity: 'warning',
            message: `Telnyx number ${telnyxNum} is not assigned in VSP-VOIP`,
            details: { number: telnyxNum },
          });
        }
      }

      for (const num of activeNumbers) {
        if (!telnyxSet.has(num.number)) {
          alerts.push({
            type: 'DB_NOT_IN_TELNYX',
            severity: 'critical',
            message: `DB number ${num.number} is not present in Telnyx account`,
            details: { phoneNumberId: num.id, tenantId: num.tenantId },
          });
        }
      }
    } catch (err) {
      alerts.push({
        type: 'TELNYX_NOT_IN_DB',
        severity: 'warning',
        message: `Could not verify Telnyx inventory: ${err.message}`,
        details: { error: err.message },
      });
    }
  }

  const invoicedNotFulfilled = await prisma.numberOrder.findMany({
    where: {
      invoiceSentAt: { not: null },
      status: { notIn: ['FULFILLED', 'PARTIAL', 'CANCELLED'] },
    },
    select: { id: true, tenantId: true, invoiceNumber: true, status: true },
  });
  for (const order of invoicedNotFulfilled) {
    alerts.push({
      type: 'INVOICE_WITHOUT_FULFILLMENT',
      severity: 'warning',
      message: `Invoice ${order.invoiceNumber || order.id} sent but order not fulfilled`,
      details: order,
    });
  }

  const fulfilledWithoutInvoice = await prisma.numberOrder.findMany({
    where: {
      status: { in: ['FULFILLED', 'PARTIAL'] },
      paymentMethod: 'MANUAL_BANK',
      invoiceSentAt: null,
      paymentReference: { notIn: ['ADMIN_DIRECT', 'ADMIN_DIRECT_BILLABLE'] },
    },
    select: { id: true, tenantId: true, status: true },
  });
  for (const order of fulfilledWithoutInvoice) {
    alerts.push({
      type: 'FULFILLMENT_WITHOUT_INVOICE',
      severity: 'warning',
      message: `Order ${order.id} fulfilled without invoice sent`,
      details: order,
    });
  }

  const unpaidFulfilled = await prisma.numberOrder.findMany({
    where: {
      status: { in: ['FULFILLED', 'PARTIAL'] },
      paymentMethod: 'MANUAL_BANK',
      paymentReviewStatus: { not: 'APPROVED' },
      paymentReference: { notIn: ['ADMIN_DIRECT', 'ADMIN_DIRECT_BILLABLE'] },
    },
    select: { id: true, tenantId: true, status: true, paymentReviewStatus: true },
  });
  for (const order of unpaidFulfilled) {
    alerts.push({
      type: 'UNPAID_FULFILLMENT',
      severity: 'critical',
      message: `Order ${order.id} fulfilled without approved bank payment`,
      details: order,
    });
  }

  const created = [];
  for (const alert of alerts) {
    const existing = await prisma.billingIntegrityAlert.findFirst({
      where: {
        type: alert.type,
        resolvedAt: null,
        message: alert.message,
      },
    });
    if (existing) {
      created.push(existing);
      continue;
    }
    const row = await prisma.billingIntegrityAlert.create({ data: alert });
    created.push(row);
  }

  return { checkedAt: new Date().toISOString(), alertCount: created.length, alerts: created };
}

module.exports = {
  getRevenueProtectionDashboard,
  runBillingIntegrityChecks,
  listAllTelnyxNumbers,
};
