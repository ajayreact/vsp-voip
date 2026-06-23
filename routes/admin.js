const express = require('express');
const { getPrisma } = require('../db');
const { hashPassword } = require('../lib/auth');
const { authMiddleware, requireRole } = require('../lib/auth');
const {
  getTenantBillingRates,
  getOrderWithInvoice,
  markOrderInvoiceSent,
  confirmManualOrderAndFulfill,
  cancelManualOrder,
  approveBankPayment,
  rejectBankPayment,
  serializeOrder,
} = require('../lib/billing');
const {
  loadPaymentGatewaySettings,
  updatePaymentGatewaySettings,
  toAdminGatewaySettings,
  getBankPaymentStats,
} = require('../lib/paymentGateways');
const { sendWelcomeEmail, sendInvoiceEmail } = require('../lib/transactionalEmail');
const { writeAuditLog } = require('../lib/auditLog');
const { getTelnyxStatus } = require('../lib/telnyxStatus');
const { getTelnyxConnectionConfig } = require('../lib/telnyxConfig');
const { removeEmptyDuplicateTenants } = require('../lib/tenantCleanup');
const {
  getVoiceQualityReport,
  getQuotaReport,
  getSecurityReport,
  listPortRequests,
  createPortRequest,
  updatePortRequest,
  getLcrConfig,
} = require('../lib/adminModules');
const { getVoiceTelemetrySummary } = require('../lib/voiceTelemetry');
const { getExecutiveDashboard, getOperationsDashboard } = require('../lib/adminDashboard');
const { getRevenueProtectionDashboard, runBillingIntegrityChecks } = require('../lib/revenueProtection');
const { reconcileLegacyRevenueRecords } = require('../lib/revenueReconcile');
const {
  getRazorpayPaymentsReport,
  getRazorpayRefundsReport,
  getRevenueByGatewayReport,
} = require('../lib/razorpayReporting');
const { refundRazorpayOrder } = require('../lib/razorpayBilling');
const { getTenantUsageReport } = require('../lib/adminUsage');
const { getNumberInventory, releasePhoneNumber } = require('../lib/adminNumbers');
const { getReadinessStatus } = require('../lib/health');
const { normalizePhoneNumber } = require('../lib/phone');
const { setCachedTenant } = require('../lib/tenantCache');
const { assertCanAddUser } = require('../lib/quotaService');
const {
  getPublicPlatformSettings,
  updatePlatformSettings,
  loadPlatformSettings,
  getDefaultFees,
} = require('../lib/platformSettings');

const router = express.Router();

router.use(authMiddleware, requireRole('SUPER_ADMIN'));

router.get('/dashboard/executive', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const data = await getExecutiveDashboard(prisma);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('❌ Executive dashboard error:', error.message);
    res.status(500).json({ error: 'Failed to load executive dashboard' });
  }
});

router.get('/dashboard/operations', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const data = await getOperationsDashboard(prisma);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('❌ Operations dashboard error:', error.message);
    res.status(500).json({ error: 'Failed to load operations dashboard' });
  }
});

router.get('/dashboard', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const data = await getExecutiveDashboard(prisma);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('❌ Admin dashboard error:', error.message);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

router.get('/tenants/usage', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const report = await getTenantUsageReport(prisma);
    res.json({ success: true, ...report });
  } catch (error) {
    console.error('❌ Tenant usage error:', error.message);
    res.status(500).json({ error: 'Failed to load tenant usage' });
  }
});

router.get('/numbers/inventory', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const search = req.query.search ? String(req.query.search) : undefined;
    const status = req.query.status ? String(req.query.status).toUpperCase() : undefined;
    const limit = req.query.limit ? Math.min(500, Number(req.query.limit)) : 200;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const inventory = await getNumberInventory(prisma, {
      search,
      status,
      limit,
      offset,
      apiKey: process.env.TELNYX_API_KEY?.trim(),
    });
    res.json({ success: true, ...inventory });
  } catch (error) {
    console.error('❌ Number inventory error:', error.message);
    res.status(500).json({ error: 'Failed to load number inventory' });
  }
});

router.post('/numbers/:id/release', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const released = await releasePhoneNumber(prisma, req.params.id);
    if (!released) {
      return res.status(404).json({ error: 'Phone number not found' });
    }

    await writeAuditLog(prisma, req, {
      action: 'number.released',
      entityType: 'PhoneNumber',
      entityId: released.id,
      details: { number: released.number, tenantId: released.tenantId },
    });

    res.json({ success: true, number: released });
  } catch (error) {
    console.error('❌ Release number error:', error.message);
    res.status(500).json({ error: 'Failed to release phone number' });
  }
});

router.get('/platform-settings', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const settings = await getPublicPlatformSettings(prisma);
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load platform settings' });
  }
});

router.put('/platform-settings', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const {
      stripeSecretKey,
      stripeWebhookSecret,
      stripePublishableKey,
      defaultFeeSetup,
      defaultFeeMonthly,
      defaultFeeFirstMonth,
      bankName,
      bankAccountName,
      bankAccountNumber,
      bankRoutingNumber,
      bankSwiftCode,
      bankPaymentInstructions,
      invoiceContactEmail,
      telnyxConnectionId,
      telnyxConnectionName,
      telnyxCredentialConnectionId,
      telnyxMessagingProfileId,
      telnyxCallControlApplicationId,
    } = req.body;

    const settings = await updatePlatformSettings(prisma, {
      stripeSecretKey,
      stripeWebhookSecret,
      stripePublishableKey,
      defaultFeeSetup: defaultFeeSetup !== undefined ? Number(defaultFeeSetup) : undefined,
      defaultFeeMonthly: defaultFeeMonthly !== undefined ? Number(defaultFeeMonthly) : undefined,
      defaultFeeFirstMonth,
      bankName,
      bankAccountName,
      bankAccountNumber,
      bankRoutingNumber,
      bankSwiftCode,
      bankPaymentInstructions,
      invoiceContactEmail,
      telnyxConnectionId,
      telnyxConnectionName,
      telnyxCredentialConnectionId,
      telnyxMessagingProfileId,
      telnyxCallControlApplicationId,
    });

    await writeAuditLog(prisma, req, {
      action: 'platform_settings.updated',
      entityType: 'PlatformSettings',
      entityId: 'platform',
    });

    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save platform settings' });
  }
});

router.get('/tenants', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { phoneNumbers: true, users: true } },
      },
    });

    res.json({
      success: true,
      tenants: tenants.map((t) => ({
        id: t.id,
        name: t.name,
        isActive: t.isActive,
        platformFeeSetup: Number(t.platformFeeSetup),
        platformFeeMonthly: Number(t.platformFeeMonthly),
        platformFeeFirstMonth: t.platformFeeFirstMonth != null ? Number(t.platformFeeFirstMonth) : null,
        stripeCustomerId: t.stripeCustomerId,
        stripeSubscriptionId: t.stripeSubscriptionId,
        numberCount: t._count.phoneNumbers,
        userCount: t._count.users,
        createdAt: t.createdAt,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load tenants' });
  }
});

router.post('/tenants/cleanup-empty', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const result = await removeEmptyDuplicateTenants(prisma);

    if (result.removed > 0) {
      await writeAuditLog(prisma, req, {
        action: 'tenant.cleanup_empty',
        entityType: 'Tenant',
        details: { removed: result.removed },
      });
    }

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('❌ Tenant cleanup error:', error.message);
    res.status(500).json({ error: 'Failed to clean up empty tenants' });
  }
});

router.get('/tenants/:id', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      include: {
        users: { select: { id: true, email: true, name: true, role: true } },
        phoneNumbers: true,
        _count: { select: { callLogs: true, numberOrders: true } },
      },
    });

    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    res.json({
      success: true,
      tenant: {
        ...tenant,
        isActive: tenant.isActive,
        platformFeeSetup: Number(tenant.platformFeeSetup),
        platformFeeMonthly: Number(tenant.platformFeeMonthly),
        platformFeeFirstMonth: tenant.platformFeeFirstMonth != null
          ? Number(tenant.platformFeeFirstMonth)
          : null,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load tenant' });
  }
});

router.post('/tenants', async (req, res) => {
  try {
    const {
      name,
      platformFeeSetup,
      platformFeeMonthly,
      platformFeeFirstMonth,
      adminEmail,
      adminName,
      adminPassword,
    } = req.body;
    const trimmedName = String(name).trim();
    if (!trimmedName) {
      return res.status(400).json({ error: 'name is required' });
    }

    const trimmedAdminEmail = adminEmail ? String(adminEmail).toLowerCase().trim() : '';
    const trimmedAdminName = adminName ? String(adminName).trim() : '';
    const adminPasswordValue = adminPassword ? String(adminPassword) : '';

    if (trimmedAdminEmail || trimmedAdminName || adminPasswordValue) {
      if (!trimmedAdminEmail || !trimmedAdminName || !adminPasswordValue) {
        return res.status(400).json({
          error: 'Tenant admin name, email, and password are all required',
        });
      }
      if (adminPasswordValue.length < 6) {
        return res.status(400).json({ error: 'Tenant admin password must be at least 6 characters' });
      }
    }

    const prisma = await getPrisma();

    const existing = await prisma.tenant.findFirst({
      where: { name: { equals: trimmedName, mode: 'insensitive' } },
      select: { id: true, name: true },
    });
    if (existing) {
      return res.status(409).json({
        error: `A tenant named "${existing.name}" already exists. Open it from the list instead of creating a duplicate.`,
      });
    }

    if (trimmedAdminEmail) {
      const emailTaken = await prisma.user.findUnique({
        where: { email: trimmedAdminEmail },
        select: { id: true },
      });
      if (emailTaken) {
        return res.status(409).json({ error: 'Email already in use' });
      }
    }

    const platform = await loadPlatformSettings(prisma);
    const defaults = getDefaultFees(platform);

    const tenant = await prisma.tenant.create({
      data: {
        name: trimmedName,
        platformFeeSetup: platformFeeSetup ?? defaults.setup,
        platformFeeMonthly: platformFeeMonthly ?? defaults.monthly,
        platformFeeFirstMonth: platformFeeFirstMonth ?? null,
        greeting: {
          create: {
            message: 'Welcome to {company}. Your call is connected.',
          },
        },
      },
    });

    let adminUser = null;
    if (trimmedAdminEmail) {
      adminUser = await prisma.user.create({
        data: {
          email: trimmedAdminEmail,
          name: trimmedAdminName,
          passwordHash: await hashPassword(adminPasswordValue),
          role: 'TENANT_ADMIN',
          tenantId: tenant.id,
        },
      });

      await writeAuditLog(prisma, req, {
        action: 'tenant.user_created',
        entityType: 'User',
        entityId: adminUser.id,
        details: { email: adminUser.email, role: adminUser.role, tenantId: tenant.id },
      });
    }

    await writeAuditLog(prisma, req, {
      action: 'tenant.created',
      entityType: 'Tenant',
      entityId: tenant.id,
      details: { name: tenant.name },
    });

    if (adminUser) {
      await sendWelcomeEmail({
        name: adminUser.name,
        email: adminUser.email,
        tenantName: tenant.name,
        temporaryPassword: adminPasswordValue,
      }).catch((err) => console.warn('⚠️ Welcome email failed:', err.message));
    }

    res.status(201).json({
      success: true,
      tenant,
      adminUser: adminUser
        ? { id: adminUser.id, email: adminUser.email, name: adminUser.name, role: adminUser.role }
        : null,
    });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'Email already in use' });
    res.status(500).json({ error: 'Failed to create tenant' });
  }
});

router.put('/tenants/:id/billing', async (req, res) => {
  try {
    const { platformFeeSetup, platformFeeMonthly, platformFeeFirstMonth } = req.body;
    const prisma = await getPrisma();
    const platform = await loadPlatformSettings(prisma);

    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data: {
        ...(platformFeeSetup !== undefined ? { platformFeeSetup } : {}),
        ...(platformFeeMonthly !== undefined ? { platformFeeMonthly } : {}),
        ...(platformFeeFirstMonth !== undefined
          ? { platformFeeFirstMonth: platformFeeFirstMonth === '' ? null : platformFeeFirstMonth }
          : {}),
      },
    });

    await writeAuditLog(prisma, req, {
      action: 'tenant.billing_updated',
      entityType: 'Tenant',
      entityId: tenant.id,
      details: {
        platformFeeSetup: Number(tenant.platformFeeSetup),
        platformFeeMonthly: Number(tenant.platformFeeMonthly),
        platformFeeFirstMonth: tenant.platformFeeFirstMonth != null
          ? Number(tenant.platformFeeFirstMonth)
          : null,
      },
    });

    res.json({
      success: true,
      billing: getTenantBillingRates(tenant, platform),
      tenant: {
        id: tenant.id,
        name: tenant.name,
        platformFeeSetup: Number(tenant.platformFeeSetup),
        platformFeeMonthly: Number(tenant.platformFeeMonthly),
        platformFeeFirstMonth: tenant.platformFeeFirstMonth != null
          ? Number(tenant.platformFeeFirstMonth)
          : null,
      },
    });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Tenant not found' });
    res.status(500).json({ error: 'Failed to update billing' });
  }
});

router.put('/tenants/:id/status', async (req, res) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive boolean is required' });
    }

    const prisma = await getPrisma();
    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data: { isActive },
      include: {
        _count: { select: { phoneNumbers: true, users: true } },
      },
    });

    await writeAuditLog(prisma, req, {
      action: isActive ? 'tenant.activated' : 'tenant.suspended',
      entityType: 'Tenant',
      entityId: tenant.id,
      details: { name: tenant.name, isActive },
    });

    res.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        isActive: tenant.isActive,
        platformFeeSetup: Number(tenant.platformFeeSetup),
        platformFeeMonthly: Number(tenant.platformFeeMonthly),
        platformFeeFirstMonth: tenant.platformFeeFirstMonth != null
          ? Number(tenant.platformFeeFirstMonth)
          : null,
        numberCount: tenant._count.phoneNumbers,
        userCount: tenant._count.users,
        createdAt: tenant.createdAt,
      },
    });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Tenant not found' });
    res.status(500).json({ error: 'Failed to update tenant status' });
  }
});

router.put('/tenants/:id', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

    const prisma = await getPrisma();
    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data: { name: String(name).trim() },
    });

    res.json({ success: true, tenant });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Tenant not found' });
    res.status(500).json({ error: 'Failed to update tenant' });
  }
});

router.post('/tenants/:id/users', async (req, res) => {
  try {
    const { email, name, password, role } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'email, name, and password are required' });
    }

    const prisma = await getPrisma();
    const tenant = await prisma.tenant.findUnique({ where: { id: req.params.id } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    if (!tenant.isActive) {
      return res.status(400).json({ error: 'Cannot add users to a suspended tenant. Activate the tenant first.' });
    }

    const allowedRoles = ['TENANT_ADMIN', 'TENANT_USER'];
    const userRole = allowedRoles.includes(role) ? role : 'TENANT_ADMIN';
    if (role === 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'SUPER_ADMIN role cannot be assigned via tenant user creation' });
    }

    await assertCanAddUser(prisma, tenant.id);

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email: String(email).toLowerCase().trim(),
        name: String(name).trim(),
        passwordHash,
        role: userRole,
        tenantId: tenant.id,
      },
    });

    await writeAuditLog(prisma, req, {
      action: 'tenant.user_created',
      entityType: 'User',
      entityId: user.id,
      details: { email: user.email, role: user.role, tenantId: tenant.id },
    });

    res.status(201).json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (error) {
    if (error.status === 403) {
      return res.status(403).json({
        error: error.message,
        code: error.code || undefined,
        quota: error.quota || undefined,
      });
    }
    if (error.code === 'P2002') return res.status(409).json({ error: 'Email already in use' });
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.post('/numbers/assign', async (req, res) => {
  try {
    const { phoneNumber, tenantId } = req.body;

    if (!phoneNumber || !tenantId) {
      return res.status(400).json({ error: 'phoneNumber and tenantId are required' });
    }

    const normalizedNumber = normalizePhoneNumber(phoneNumber);
    if (!normalizedNumber) {
      return res.status(400).json({ error: 'Invalid phoneNumber format' });
    }

    const prisma = await getPrisma();
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const apiKey = process.env.TELNYX_API_KEY?.trim();
    const { verifyTelnyxNumberOwnership } = require('../lib/buyNumber');
    await verifyTelnyxNumberOwnership(normalizedNumber, apiKey);

    const savedNumber = await prisma.phoneNumber.upsert({
      where: { number: normalizedNumber },
      create: { number: normalizedNumber, tenantId, source: 'ADMIN_ASSIGN' },
      update: { tenantId, source: 'ADMIN_ASSIGN' },
    });

    await setCachedTenant(normalizedNumber, tenant);

    await writeAuditLog(prisma, req, {
      action: 'admin.number_assigned',
      entityType: 'PhoneNumber',
      entityId: savedNumber.id,
      details: { number: normalizedNumber, tenantId, telnyxVerified: true },
    });

    res.json({
      success: true,
      message: 'Number linked to tenant',
      data: savedNumber,
    });
  } catch (error) {
    console.error('❌ Admin assign error:', error.message);
    res.status(error.status || 500).json({ error: error.message || 'Failed to assign number to tenant' });
  }
});

router.get('/monitoring/platform-health', async (req, res) => {
  try {
    const status = await getReadinessStatus();
    res.status(status.ready ? 200 : 503).json({ success: true, ...status });
  } catch (error) {
    res.status(503).json({ success: false, error: error.message });
  }
});

router.get('/orders', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const status = req.query.status ? String(req.query.status).toUpperCase() : null;

    const orders = await prisma.numberOrder.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(req.query.paymentMethod
          ? { paymentMethod: String(req.query.paymentMethod).toUpperCase() }
          : {}),
      },
      include: { tenant: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({
      success: true,
      orders: orders.map((o) => serializeOrder(o, o.tenant)),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load orders' });
  }
});

router.get('/orders/:id', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const result = await getOrderWithInvoice({ prisma, orderId: req.params.id });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to load order' });
  }
});

router.post('/orders/:id/mark-invoice-sent', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const { emailTo, sendEmail: shouldSend } = req.body;

    const detail = await getOrderWithInvoice({ prisma, orderId: req.params.id });
    const recipient = emailTo || detail.tenantAdminEmail;

    let emailResult = null;
    if (shouldSend && recipient) {
      emailResult = await sendInvoiceEmail({
        to: recipient,
        invoice: detail.invoice,
      });
    }

    const order = await markOrderInvoiceSent({
      prisma,
      orderId: req.params.id,
      emailTo: recipient,
    });

    await writeAuditLog(prisma, req, {
      action: 'order.invoice_sent',
      entityType: 'NumberOrder',
      entityId: req.params.id,
      details: { emailTo: recipient, smtp: Boolean(shouldSend && emailResult?.sent) },
    });

    res.json({
      success: true,
      order,
      emailResult,
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to update order' });
  }
});

router.put('/orders/:id', async (req, res) => {
  try {
    const { paymentReference, adminNotes } = req.body;
    const prisma = await getPrisma();

    const order = await prisma.numberOrder.update({
      where: { id: req.params.id },
      data: {
        ...(paymentReference !== undefined ? { paymentReference: paymentReference || null } : {}),
        ...(adminNotes !== undefined ? { adminNotes: adminNotes || null } : {}),
      },
      include: { tenant: true },
    });

    await writeAuditLog(prisma, req, {
      action: 'order.updated',
      entityType: 'NumberOrder',
      entityId: order.id,
      details: { paymentReference: order.paymentReference, adminNotes: order.adminNotes },
    });

    res.json({ success: true, order: serializeOrder(order, order.tenant) });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Order not found' });
    res.status(500).json({ error: 'Failed to update order' });
  }
});

router.post('/orders/:id/fulfill', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const platform = await loadPlatformSettings(prisma);
    const { connectionId } = getTelnyxConnectionConfig(platform);

    const result = await confirmManualOrderAndFulfill({
      prisma,
      orderId: req.params.id,
      apiKey: process.env.TELNYX_API_KEY?.trim(),
      defaultConnectionId: connectionId,
      adminNotes: req.body.adminNotes,
      paymentReference: req.body.paymentReference,
    });

    await writeAuditLog(prisma, req, {
      action: 'order.fulfilled',
      entityType: 'NumberOrder',
      entityId: req.params.id,
      details: {
        paymentReference: req.body.paymentReference,
        purchased: result.purchased?.length || 0,
        failed: result.failed?.length || 0,
      },
    });

    res.json({
      success: result.failed?.length === 0,
      message: result.message,
      purchased: result.purchased,
      failed: result.failed,
      alreadyFulfilled: result.alreadyFulfilled,
      order: result.order,
    });
  } catch (error) {
    console.error('❌ Fulfill order error:', error.message);
    if (error.code === 'BANK_PAYMENT_NOT_APPROVED') {
      const prisma = await getPrisma();
      await writeAuditLog(prisma, req, {
        action: 'order.fulfillment_rejected',
        entityType: 'NumberOrder',
        entityId: req.params.id,
        details: { reason: error.message, paymentReviewStatus: 'not_approved' },
      });
    }
    res.status(error.status || 500).json({ error: error.message || 'Failed to fulfill order' });
  }
});

router.post('/orders/:id/cancel', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const order = await cancelManualOrder({
      prisma,
      orderId: req.params.id,
      adminNotes: req.body.adminNotes,
    });

    await writeAuditLog(prisma, req, {
      action: 'order.cancelled',
      entityType: 'NumberOrder',
      entityId: req.params.id,
    });

    res.json({ success: true, order });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to cancel order' });
  }
});

router.get('/revenue', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const orders = await prisma.numberOrder.findMany({
      where: { status: { in: ['FULFILLED', 'PAID', 'PARTIAL'] } },
      include: { tenant: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const byTenantMap = {};
    const byMonthMap = {};
    let totalRevenue = 0;

    for (const order of orders) {
      const amount = Number(order.totalCharged);
      totalRevenue += amount;

      if (!byTenantMap[order.tenantId]) {
        byTenantMap[order.tenantId] = {
          tenantId: order.tenantId,
          tenantName: order.tenant?.name || 'Unknown',
          revenue: 0,
          orderCount: 0,
        };
      }
      byTenantMap[order.tenantId].revenue += amount;
      byTenantMap[order.tenantId].orderCount += 1;

      const month = order.createdAt.toISOString().slice(0, 7);
      if (!byMonthMap[month]) {
        byMonthMap[month] = { month, revenue: 0, orderCount: 0 };
      }
      byMonthMap[month].revenue += amount;
      byMonthMap[month].orderCount += 1;
    }

    res.json({
      success: true,
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        orderCount: orders.length,
      },
      byTenant: Object.values(byTenantMap).sort((a, b) => b.revenue - a.revenue),
      byMonth: Object.values(byMonthMap).sort((a, b) => b.month.localeCompare(a.month)),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load revenue report' });
  }
});

router.get('/audit-log', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const take = Math.min(Number(req.query.limit) || 50, 200);

    const logs = await prisma.adminAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take,
    });

    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load audit log' });
  }
});

router.get('/telnyx/status', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const status = await getTelnyxStatus(prisma);
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check Telnyx status' });
  }
});

router.get('/voice-quality', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const platform = await loadPlatformSettings(prisma);
    const [report, telemetry] = await Promise.all([
      getVoiceQualityReport(prisma),
      getVoiceTelemetrySummary(prisma, platform, { refreshSip: true }),
    ]);
    res.json({ success: true, report, telemetry });
  } catch (error) {
    console.error('❌ Voice quality report error:', error.message);
    res.status(500).json({ error: 'Failed to load voice quality report' });
  }
});

router.get('/quotas', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const platform = await loadPlatformSettings(prisma);
    const report = await getQuotaReport(prisma, platform);
    res.json({ success: true, ...report });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load quota report' });
  }
});

router.put('/quotas/defaults', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const settings = await updatePlatformSettings(prisma, {
      defaultMaxUsers: req.body.defaultMaxUsers,
      defaultMaxPhoneNumbers: req.body.defaultMaxPhoneNumbers,
      defaultMaxConcurrentCalls: req.body.defaultMaxConcurrentCalls,
    });

    await writeAuditLog(prisma, req, {
      action: 'quota.defaults_updated',
      entityType: 'PlatformSettings',
      entityId: 'platform',
      details: {
        defaultMaxUsers: settings.defaultMaxUsers,
        defaultMaxPhoneNumbers: settings.defaultMaxPhoneNumbers,
        defaultMaxConcurrentCalls: settings.defaultMaxConcurrentCalls,
      },
    });

    const platform = await loadPlatformSettings(prisma, { force: true });
    const report = await getQuotaReport(prisma, platform);
    res.json({ success: true, settings, ...report });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update quota defaults' });
  }
});

router.put('/tenants/:id/quotas', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const { maxUsers, maxPhoneNumbers, maxConcurrentCalls } = req.body;

    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data: {
        ...(maxUsers !== undefined ? { maxUsers: maxUsers === '' || maxUsers === null ? null : Number(maxUsers) } : {}),
        ...(maxPhoneNumbers !== undefined
          ? { maxPhoneNumbers: maxPhoneNumbers === '' || maxPhoneNumbers === null ? null : Number(maxPhoneNumbers) }
          : {}),
        ...(maxConcurrentCalls !== undefined
          ? { maxConcurrentCalls: maxConcurrentCalls === '' || maxConcurrentCalls === null ? null : Number(maxConcurrentCalls) }
          : {}),
      },
    });

    await writeAuditLog(prisma, req, {
      action: 'tenant.quotas_updated',
      entityType: 'Tenant',
      entityId: tenant.id,
      details: {
        maxUsers: tenant.maxUsers,
        maxPhoneNumbers: tenant.maxPhoneNumbers,
        maxConcurrentCalls: tenant.maxConcurrentCalls,
      },
    });

    const platform = await loadPlatformSettings(prisma);
    const report = await getQuotaReport(prisma, platform);
    res.json({ success: true, tenant, tenants: report.tenants });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Tenant not found' });
    res.status(500).json({ error: 'Failed to update tenant quotas' });
  }
});

router.get('/porting', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const status = req.query.status ? String(req.query.status).toUpperCase() : null;
    const requests = await listPortRequests(prisma, status);
    res.json({ success: true, requests });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load port requests' });
  }
});

router.post('/porting', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const request = await createPortRequest(prisma, req.body);

    await writeAuditLog(prisma, req, {
      action: 'porting.created',
      entityType: 'PortRequest',
      entityId: request.id,
      details: { tenantId: request.tenantId, phoneNumbers: request.phoneNumbers },
    });

    res.status(201).json({ success: true, request });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to create port request' });
  }
});

router.put('/porting/:id', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const request = await updatePortRequest(prisma, req.params.id, req.body);

    await writeAuditLog(prisma, req, {
      action: 'porting.updated',
      entityType: 'PortRequest',
      entityId: request.id,
      details: { status: request.status, adminNotes: request.adminNotes },
    });

    res.json({ success: true, request });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to update port request' });
  }
});

router.get('/trunking/lcr', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const platform = await loadPlatformSettings(prisma);
    res.json({ success: true, lcr: getLcrConfig(platform) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load LCR settings' });
  }
});

router.put('/trunking/lcr', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const settings = await updatePlatformSettings(prisma, {
      lcrPrimaryConnectionId: req.body.primaryConnectionId,
      lcrFallbackConnectionId: req.body.fallbackConnectionId,
      lcrNotes: req.body.notes,
    });

    await writeAuditLog(prisma, req, {
      action: 'lcr.updated',
      entityType: 'PlatformSettings',
      entityId: 'platform',
      details: {
        lcrPrimaryConnectionId: settings.lcrPrimaryConnectionId,
        lcrFallbackConnectionId: settings.lcrFallbackConnectionId,
      },
    });

    const platform = await loadPlatformSettings(prisma, { force: true });
    res.json({ success: true, lcr: getLcrConfig(platform) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update LCR settings' });
  }
});

router.get('/revenue-protection', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const dashboard = await getRevenueProtectionDashboard(prisma);
    res.json({ success: true, dashboard });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load revenue protection dashboard' });
  }
});

router.post('/revenue/reconcile', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const dryRun = Boolean(req.body?.dryRun);
    const report = await reconcileLegacyRevenueRecords(prisma, { dryRun });

    await writeAuditLog(prisma, req, {
      action: 'revenue.reconciled',
      entityType: 'NumberOrder',
      entityId: 'system',
      details: {
        dryRun,
        ordersScanned: report.ordersScanned,
        ordersRepaired: report.ordersRepaired.length,
        phonesRepaired: report.phonesRepaired.length,
        receivablesUpdated: report.receivablesUpdated.length,
        alertsResolved: report.alertsResolved.length,
        errors: report.errors.length,
      },
    });

    res.json({ success: true, report });
  } catch (error) {
    console.error('❌ Revenue reconcile error:', error.message);
    res.status(500).json({ error: error.message || 'Reconciliation failed' });
  }
});

router.get('/reports/razorpay/payments', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const report = await getRazorpayPaymentsReport(prisma);
    res.json({ success: true, ...report });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load Razorpay payments report' });
  }
});

router.get('/reports/razorpay/refunds', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const report = await getRazorpayRefundsReport(prisma);
    res.json({ success: true, ...report });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load Razorpay refunds report' });
  }
});

router.get('/reports/revenue-by-gateway', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const report = await getRevenueByGatewayReport(prisma);
    res.json({ success: true, ...report });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load revenue by gateway report' });
  }
});

router.post('/orders/:id/razorpay-refund', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const result = await refundRazorpayOrder({
      prisma,
      orderId: req.params.id,
      amountUsd: req.body.amount,
      reason: req.body.reason,
    });

    await writeAuditLog(prisma, req, {
      action: 'order.refunded',
      entityType: 'NumberOrder',
      entityId: req.params.id,
      details: {
        gateway: 'RAZORPAY',
        refundId: result.refundId,
        amount: result.amount,
        reason: req.body.reason || null,
      },
    });

    res.json({ success: true, ...result });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Refund failed' });
  }
});

router.post('/billing-integrity/run', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const result = await runBillingIntegrityChecks(prisma);

    await writeAuditLog(prisma, req, {
      action: 'billing_integrity.run',
      entityType: 'BillingIntegrityAlert',
      entityId: 'system',
      details: { alertCount: result.alertCount },
    });

    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Integrity check failed' });
  }
});

router.get('/billing-integrity/alerts', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const resolved = req.query.resolved === 'true';
    const alerts = await prisma.billingIntegrityAlert.findMany({
      where: resolved ? { resolvedAt: { not: null } } : { resolvedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ success: true, alerts });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load integrity alerts' });
  }
});

router.post('/billing-integrity/alerts/:id/resolve', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const alert = await prisma.billingIntegrityAlert.update({
      where: { id: req.params.id },
      data: { resolvedAt: new Date() },
    });
    res.json({ success: true, alert });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

router.get('/payment-gateways', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const gateway = await loadPaymentGatewaySettings(prisma);
    res.json({ success: true, settings: toAdminGatewaySettings(gateway) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load payment gateways' });
  }
});

router.put('/payment-gateways', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const settings = await updatePaymentGatewaySettings(prisma, req.body);

    await writeAuditLog(prisma, req, {
      action: 'payment_gateways.updated',
      entityType: 'PaymentGatewaySettings',
      entityId: 'default',
      details: {
        bankTransferEnabled: settings.bankTransferEnabled,
        stripeEnabled: settings.stripeEnabled,
        razorpayEnabled: settings.razorpayEnabled,
      },
    });

    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update payment gateways' });
  }
});

router.get('/payment-gateways/bank-stats', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const stats = await getBankPaymentStats(prisma);
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load bank payment stats' });
  }
});

router.post('/orders/:id/approve-payment', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const platform = await loadPlatformSettings(prisma);
    const { connectionId } = getTelnyxConnectionConfig(platform);

    const result = await approveBankPayment({
      prisma,
      orderId: req.params.id,
      apiKey: process.env.TELNYX_API_KEY?.trim(),
      defaultConnectionId: connectionId,
      adminNotes: req.body.adminNotes,
      paymentReference: req.body.paymentReference,
    });

    await writeAuditLog(prisma, req, {
      action: 'order.payment_approved',
      entityType: 'NumberOrder',
      entityId: req.params.id,
      details: {
        purchased: result.purchased?.length || 0,
        failed: result.failed?.length || 0,
      },
    });

    res.json({
      success: result.failed?.length === 0,
      message: result.message,
      purchased: result.purchased,
      failed: result.failed,
      order: result.order,
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to approve payment' });
  }
});

router.post('/orders/:id/reject-payment', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const order = await rejectBankPayment({
      prisma,
      orderId: req.params.id,
      adminNotes: req.body.adminNotes,
    });

    await writeAuditLog(prisma, req, {
      action: 'order.payment_rejected',
      entityType: 'NumberOrder',
      entityId: req.params.id,
      details: { adminNotes: req.body.adminNotes || null },
    });

    res.json({ success: true, order });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to reject payment' });
  }
});

router.get('/security', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const report = await getSecurityReport(prisma);
    res.json({ success: true, report });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load security report' });
  }
});

module.exports = router;
