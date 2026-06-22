const { buildInvoiceNumber, buildInvoiceContent } = require('./invoice');



async function createTenantReceivableForOrder({

  prisma,

  tenant,

  order,

  platform,

  items,

  dueDays = 14,

}) {

  const dueAt = new Date();

  dueAt.setDate(dueAt.getDate() + dueDays);



  const receivable = await prisma.tenantReceivable.create({

    data: {

      tenantId: tenant.id,

      orderId: order.id,

      invoiceNumber: order.invoiceNumber,

      amount: order.totalCharged,

      status: 'PENDING',

      dueAt,

      notes: 'Auto-generated from Super Admin direct purchase',

    },

  });



  return receivable;

}



async function ensureBankTransferReceivable({ prisma, tenant, order }) {

  const existing = await prisma.tenantReceivable.findUnique({

    where: { orderId: order.id },

  });

  if (existing) return existing;



  const dueAt = new Date();

  dueAt.setDate(dueAt.getDate() + dueDaysFromOrder());



  return prisma.tenantReceivable.create({

    data: {

      tenantId: tenant.id,

      orderId: order.id,

      invoiceNumber: order.invoiceNumber,

      amount: order.totalCharged,

      status: 'PENDING',

      dueAt,

      notes: 'Bank transfer order',

    },

  });

}



function dueDaysFromOrder() {

  return 14;

}



async function markBankTransferReceivablePaid({ prisma, orderId, paidAt = new Date() }) {

  const order = await prisma.numberOrder.findUnique({

    where: { id: orderId },

    include: { tenant: true },

  });

  if (!order) {

    const error = new Error('Order not found');

    error.status = 404;

    throw error;

  }



  await ensureBankTransferReceivable({ prisma, tenant: order.tenant, order });



  return prisma.tenantReceivable.update({

    where: { orderId },

    data: {

      status: 'PAID',

      paidAt,

    },

  });

}



async function ensureOrderInvoice({ prisma, order, tenant, platform, items }) {

  let invoiceNumber = order.invoiceNumber;

  if (!invoiceNumber) {

    invoiceNumber = buildInvoiceNumber();

    await prisma.numberOrder.update({

      where: { id: order.id },

      data: { invoiceNumber },

    });

  }



  const { calculateCartPricing } = require('./billing');

  const pricing = calculateCartPricing(items, tenant, platform);

  const invoice = buildInvoiceContent({

    order: { ...order, invoiceNumber },

    tenant,

    platform,

    pricing,

  });



  return { invoiceNumber, invoice };

}



module.exports = {

  createTenantReceivableForOrder,

  ensureBankTransferReceivable,

  markBankTransferReceivablePaid,

  ensureOrderInvoice,

};


