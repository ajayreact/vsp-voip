async function getRazorpayPaymentsReport(prisma) {
  const orders = await prisma.numberOrder.findMany({
    where: { paymentMethod: 'RAZORPAY' },
    include: { tenant: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  const summary = {
    totalOrders: orders.length,
    paid: 0,
    pending: 0,
    failed: 0,
    fulfilled: 0,
    totalCollected: 0,
    totalRefunded: 0,
  };

  const rows = orders.map((o) => {
    const amount = Number(o.totalCharged);
    const isPaid = Boolean(o.invoicePaidAt) || ['FULFILLED', 'PARTIAL', 'PAID'].includes(o.status);
    const isFailed = Boolean(o.paymentFailureReason) && !isPaid;
    const isFulfilled = ['FULFILLED', 'PARTIAL'].includes(o.status);

    if (isPaid) {
      summary.paid += 1;
      summary.totalCollected += amount;
    } else if (isFailed) summary.failed += 1;
    else summary.pending += 1;
    if (isFulfilled) summary.fulfilled += 1;
    if (o.refundedAt) summary.totalRefunded += Number(o.refundAmount || amount);

    return {
      id: o.id,
      invoiceNumber: o.invoiceNumber,
      tenantName: o.tenant?.name,
      status: o.status,
      amount,
      currency: o.currency,
      razorpayOrderId: o.razorpayOrderId,
      razorpayPaymentId: o.razorpayPaymentId,
      invoicePaidAt: o.invoicePaidAt,
      paymentFailureReason: o.paymentFailureReason,
      refundedAt: o.refundedAt,
      refundAmount: o.refundAmount != null ? Number(o.refundAmount) : null,
      createdAt: o.createdAt,
    };
  });

  return { summary, payments: rows };
}

async function getRazorpayRefundsReport(prisma) {
  const refunds = await prisma.paymentRefund.findMany({
    where: { paymentMethod: 'RAZORPAY' },
    include: {
      order: { select: { invoiceNumber: true, status: true } },
      tenant: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  const totalRefunded = refunds.reduce((sum, r) => sum + Number(r.amount), 0);

  return {
    summary: { count: refunds.length, totalRefunded: Math.round(totalRefunded * 100) / 100 },
    refunds: refunds.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      invoiceNumber: r.order?.invoiceNumber,
      tenantName: r.tenant?.name,
      gatewayPaymentId: r.gatewayPaymentId,
      gatewayRefundId: r.gatewayRefundId,
      amount: Number(r.amount),
      currency: r.currency,
      status: r.status,
      reason: r.reason,
      createdAt: r.createdAt,
    })),
  };
}

async function getRevenueByGatewayReport(prisma) {
  const orders = await prisma.numberOrder.findMany({
    where: {
      status: { in: ['FULFILLED', 'PARTIAL', 'PAID'] },
      invoicePaidAt: { not: null },
    },
    select: {
      paymentMethod: true,
      totalCharged: true,
      refundAmount: true,
      refundedAt: true,
    },
  });

  const byGateway = {};
  for (const o of orders) {
    const method = o.paymentMethod || 'UNKNOWN';
    if (!byGateway[method]) {
      byGateway[method] = { paymentMethod: method, revenue: 0, refunds: 0, net: 0, orderCount: 0 };
    }
    const amount = Number(o.totalCharged);
    byGateway[method].revenue += amount;
    byGateway[method].orderCount += 1;
    if (o.refundedAt) {
      byGateway[method].refunds += Number(o.refundAmount || amount);
    }
  }

  const gateways = Object.values(byGateway).map((g) => ({
    ...g,
    revenue: Math.round(g.revenue * 100) / 100,
    refunds: Math.round(g.refunds * 100) / 100,
    net: Math.round((g.revenue - g.refunds) * 100) / 100,
  }));

  const totals = gateways.reduce(
    (acc, g) => ({
      revenue: acc.revenue + g.revenue,
      refunds: acc.refunds + g.refunds,
      net: acc.net + g.net,
      orderCount: acc.orderCount + g.orderCount,
    }),
    { revenue: 0, refunds: 0, net: 0, orderCount: 0 },
  );

  return {
    totals: {
      revenue: Math.round(totals.revenue * 100) / 100,
      refunds: Math.round(totals.refunds * 100) / 100,
      net: Math.round(totals.net * 100) / 100,
      orderCount: totals.orderCount,
    },
    gateways: gateways.sort((a, b) => b.net - a.net),
  };
}

module.exports = {
  getRazorpayPaymentsReport,
  getRazorpayRefundsReport,
  getRevenueByGatewayReport,
};
