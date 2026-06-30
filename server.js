require('dotenv').config();
const { validateEnv } = require('./lib/env');
const envConfig = validateEnv();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { getPrisma } = require('./db');
const { normalizePhoneNumber } = require('./lib/phone');
const { parseDurationSeconds, classifyCallType } = require('./lib/callLogMeta');
const { applyNumberRoutingToGreeting } = require('./lib/numberRouting');
const { getCachedTenant, refreshTenantCache, setCachedTenant, getTenantCacheSize } = require('./lib/tenantCache');
const { claimGreetingSession, clearGreetingSession } = require('./lib/greetingDedup');
const { evaluateTelnyxWebhookDedup } = require('./lib/telnyxWebhookDedup');
const { isTenantOperational } = require('./lib/tenantGuard');
const { buildGreetingTexml, buildSayAndHangupTexml } = require('./lib/texml');
const { buildInboundCallTexml } = require('./lib/callRouting');
const { requiresCallControlRouting } = require('./lib/inboundRouting');
const { saveVoicemailFromPayload } = require('./lib/voicemail');
const { saveCallRecordingFromPayload } = require('./lib/callRecording');
const { handleCallControlRecordingWebhook } = require('./lib/outboundRecording');
const { ensureTelnyxRecordingSetup } = require('./lib/telnyxRecordingSetup');
const { ensureTelnyxMessagingSetup } = require('./lib/telnyxMessagingSetup');
const { ensureTelnyxCallControlSetup } = require('./lib/telnyxCallControlSetup');
const { handleInboundCallControlEvent } = require('./lib/inboundCallControl');
const { handleTelnyxSmsEvent } = require('./lib/sms');
const { handleTelnyxVoiceTelemetryEvent, startVoiceTelemetryMonitor } = require('./lib/voiceTelemetry');
const { loadPlatformSettings } = require('./lib/platformSettings');
const { getHealthStatus, getReadinessStatus } = require('./lib/health');
const { expireBillingGracePeriods } = require('./lib/billingGrace');
const { startBillingIntegrityScheduler } = require('./lib/billingIntegrityJob');
const { webhookLimiter } = require('./lib/rateLimit');
const { logger } = require('./lib/logger');
const messagingRoutes = require('./routes/messaging');
const aiRoutes = require('./routes/ai');
const aiSummaryRoutes = require('./routes/aiSummaries');
const aiTranscriptRoutes = require('./routes/aiTranscripts');
const aiAssistantRoutes = require('./routes/aiAssistant');
const portalRoutes = require('./routes/portal');
const adminRoutes = require('./routes/admin');
const { handleStripeWebhook } = require('./lib/billing');
const { handleRazorpayWebhook } = require('./lib/razorpayBilling');
const {
    parseTelnyxFormBody,
    parseTelnyxJsonBody,
    parseTelnyxWebhookBody,
    verifyTelnyxWebhookMiddleware,
} = require('./lib/telnyxVerify');

const app = express();
app.set('trust proxy', 1);

const defaultWebOrigin = process.env.WEB_ORIGIN || 'http://localhost:3001';
const adminWebOrigin = process.env.ADMIN_ORIGIN || '';

function isAllowedWebOrigin(origin) {
    if (!origin) return true;

    const allowed = new Set([
        defaultWebOrigin,
        'http://localhost:3001',
        'http://127.0.0.1:3001',
    ]);

    if (adminWebOrigin) {
        allowed.add(adminWebOrigin);
    }

    if (process.env.WEB_ORIGIN_LAN) {
        allowed.add(process.env.WEB_ORIGIN_LAN);
    }

    if (allowed.has(origin)) return true;

    // Allow LAN access to the dev portal (e.g. http://192.168.0.138:3001).
    return /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}:3001$/.test(origin);
}

app.use(cors({
    origin(origin, callback) {
        if (isAllowedWebOrigin(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
}));

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
}));

app.get('/health', async (req, res) => {
    try {
        const status = await getHealthStatus();
        res.json(status);
    } catch (error) {
        res.status(500).json({ status: 'error', error: error.message });
    }
});

app.get('/ready', async (req, res) => {
    try {
        const status = await getReadinessStatus();
        res.status(status.ready ? 200 : 503).json(status);
    } catch (error) {
        res.status(503).json({ ready: false, error: error.message });
    }
});

app.post(
    '/api/billing/webhook',
    webhookLimiter,
    express.raw({ type: 'application/json' }),
    async (req, res) => {
        try {
            await handleStripeWebhook(req.body, req.headers['stripe-signature']);
            res.json({ received: true });
        } catch (error) {
            console.error('❌ Stripe webhook error:', error.message);
            res.status(400).send(`Webhook Error: ${error.message}`);
        }
    },
);

app.post(
    '/api/billing/razorpay-webhook',
    webhookLimiter,
    express.raw({ type: 'application/json' }),
    async (req, res) => {
        try {
            await handleRazorpayWebhook(req.body, req.headers['x-razorpay-signature']);
            res.json({ received: true });
        } catch (error) {
            console.error('❌ Razorpay webhook error:', error.message);
            const status = error.status || 400;
            res.status(status).json({ error: error.message || 'Webhook failed' });
        }
    },
);

const smsWebhookMiddleware = [parseTelnyxJsonBody, verifyTelnyxWebhookMiddleware];

async function handleTelnyxSmsWebhook(req, res) {
    const eventType = req.body?.data?.event_type || '(unknown)';
    console.log('💬 SMS event from Telnyx:', eventType);

    try {
        const prisma = await getPrisma();
        const saved = await handleTelnyxSmsEvent(prisma, req.body);
        if (saved) {
            console.log('   ↳ SMS saved/updated:', saved.id);
        }
    } catch (error) {
        console.error('❌ SMS webhook error:', error.message);
    }

    res.status(200).json({ received: true });
}

app.post('/webhook/sms', ...smsWebhookMiddleware, (req, res) => {
    handleTelnyxSmsWebhook(req, res).catch((error) => {
        console.error('❌ SMS webhook handler error:', error.message);
        res.status(500).json({ error: 'SMS webhook failed' });
    });
});

const voiceWebhookMiddleware = [parseTelnyxJsonBody, verifyTelnyxWebhookMiddleware];
const recordingWebhookMiddleware = [parseTelnyxWebhookBody, verifyTelnyxWebhookMiddleware];

app.post('/webhook/call-control', ...voiceWebhookMiddleware, (req, res) => {
    handleTelnyxCallControlWebhook(req, res).catch((error) => {
        console.error('❌ Call Control webhook error:', error.message);
        res.status(500).json({ error: 'Call Control webhook failed' });
    });
});

app.get('/webhook/voice', (req, res) => {
    res.status(200).json({
        ok: true,
        endpoint: '/webhook/voice',
        method: 'POST',
        message: 'Voice webhook is active. Telnyx sends POST events here (recordings, call telemetry). Browser GET requests are normal health checks.',
    });
});

app.post('/webhook/voice', ...voiceWebhookMiddleware, (req, res) => {
    handleTelnyxVoiceWebhook(req, res).catch((error) => {
        console.error('❌ Voice webhook error:', error.message);
        res.status(500).json({ error: 'Voice webhook failed' });
    });
});

app.post('/webhook/call-recording', ...recordingWebhookMiddleware, (req, res) => {
    handleTelnyxCallRecordingWebhook(req, res).catch((error) => {
        console.error('❌ Call recording webhook error:', error.message);
        res.status(500).send('');
    });
});

app.use((req, res, next) => {
  const isAttachmentUpload = req.method === 'POST' && req.path === '/api/messages/attachments';
  const parser = express.json({ limit: isAttachmentUpload ? '8mb' : '100kb' });
  return parser(req, res, next);
});
app.use('/uploads/greetings', express.static(path.join(__dirname, 'uploads', 'greetings')));
app.use('/uploads/payment-proofs', express.static(path.join(__dirname, 'uploads', 'payment-proofs')));
app.use('/api', messagingRoutes);
app.use('/api', aiRoutes);
app.use('/api', aiSummaryRoutes);
app.use('/api', aiTranscriptRoutes);
app.use('/api', aiAssistantRoutes);
app.use('/api', portalRoutes);
app.use('/api/admin', adminRoutes);

function getPublicWebhookBase(req) {
    if (process.env.API_PUBLIC_URL) {
        return process.env.API_PUBLIC_URL.replace(/\/$/, '');
    }
    return `${req.protocol}://${req.get('host')}`;
}

function getVoicemailRecordingActionUrl(req) {
    return `${getPublicWebhookBase(req)}/webhook/voicemail`;
}

function getCallRecordingCallbackUrl(req) {
    return `${getPublicWebhookBase(req)}/webhook/call-recording`;
}

function isStatusCallback(payload) {
    const callbackSource = (payload.CallbackSource || payload.callback_source || '').toLowerCase();
    if (callbackSource === 'call-progress-events') return true;
    if (payload.ParentCallSid || payload.parent_call_sid) return true;

    const status = (payload.CallStatus || payload.call_status || '').toLowerCase();
    const terminalStatuses = ['completed', 'busy', 'failed', 'no-answer', 'canceled', 'cancelled'];
    if (terminalStatuses.includes(status)) return true;
    if (payload.EventType || payload.event_type) return true;
    if (payload.RecordingUrl || payload.recording_url) return true;
    return false;
}

async function resolveTenantByNumber(prisma, dialedNumber) {
    const normalized = normalizePhoneNumber(dialedNumber);
    if (!normalized) return null;

    return prisma.phoneNumber.findUnique({
        where: { number: normalized },
        include: { tenant: true },
    });
}

async function logCall(prisma, payload, tenantId) {
    const callSid = payload.CallSid || payload.call_sid;
    if (!callSid) return;

    const from = normalizePhoneNumber(payload.From || payload.from) || 'unknown';
    const to = normalizePhoneNumber(payload.To || payload.to) || 'unknown';
    const status = payload.CallStatus || payload.call_status || 'unknown';
    const direction = (payload.Direction || payload.direction || 'inbound').toLowerCase();
    const durationSeconds = parseDurationSeconds(payload);
    const callType = classifyCallType(status, direction);
    const terminal = ['completed', 'busy', 'failed', 'no-answer', 'canceled', 'cancelled'].includes(String(status).toLowerCase());

    await prisma.callLog.upsert({
        where: { callSid },
        create: {
            callSid,
            from,
            to,
            status,
            tenantId,
            direction,
            callType,
            durationSeconds,
            ...(terminal ? { endedAt: new Date() } : {}),
        },
        update: {
            status,
            direction,
            callType,
            ...(durationSeconds != null ? { durationSeconds } : {}),
            ...(terminal ? { endedAt: new Date() } : {}),
            ...(tenantId ? { tenantId } : {}),
        },
    });
}

async function handleTelnyxWebhook(req, res) {
    const payload = req.method === 'GET' ? req.query : req.body;
    console.log('👉 Received a call event from Telnyx!');
    console.log('   Method:', req.method);
    console.log('   From:', payload.From || payload.from);
    console.log('   To:', payload.To || payload.to);
    console.log('   CallSid:', payload.CallSid || payload.call_sid);
    console.log('   CallStatus:', payload.CallStatus || payload.call_status || '(none)');
    console.log('   CallbackSource:', payload.CallbackSource || payload.callback_source || '(none)');
    console.log('   ParentCallSid:', payload.ParentCallSid || payload.parent_call_sid || '(none)');

    const callStatus = (payload.CallStatus || payload.call_status || '').toLowerCase();
    if (['completed', 'busy', 'failed', 'no-answer', 'canceled', 'cancelled'].includes(callStatus)) {
        await clearGreetingSession(payload.From || payload.from, payload.To || payload.to);
    }

    if (isStatusCallback(payload)) {
        console.log('   ↳ Status callback — ack only (no TeXML)');
        res.status(200).send('');
        setImmediate(() => {
            handleCallLogging(payload, null).catch((error) => {
                console.error('❌ Call logging error:', error.message);
            });
        });
        return;
    }

    const prisma = await getPrisma();
    const digits = payload.Digits || payload.digits;
    let tenant = await getCachedTenant(payload.To || payload.to);
    let greeting = null;

    if (tenant) {
        greeting = await prisma.greeting.findUnique({ where: { tenantId: tenant.id } });
        const fullTenant = await prisma.tenant.findUnique({ where: { id: tenant.id } });
        if (fullTenant) tenant = fullTenant;
    }

    if (digits && tenant && greeting?.ivrEnabled) {
        const webhookUrl = `${getPublicWebhookBase(req)}/webhook`;
        const voicemailRecordingActionUrl = getVoicemailRecordingActionUrl(req);
        const callRecordingCallbackUrl = getCallRecordingCallbackUrl(req);
        const texmlResponse = buildInboundCallTexml({
            tenant,
            greeting,
            payload,
            webhookUrl,
            voicemailRecordingActionUrl,
            callRecordingCallbackUrl,
        });
        console.log('   ↳ Sending IVR response TeXML');
        res.status(200).type('application/xml').send(texmlResponse);
        setImmediate(() => {
            handleCallLogging(payload, tenant).catch((error) => {
                console.error('❌ Call logging error:', error.message);
            });
        });
        return;
    }

    if (!(await claimGreetingSession(payload.From || payload.from, payload.To || payload.to))) {
        console.log('   ↳ Duplicate fetch — skip (no replay)');
        return res.status(200).end();
    }

    if (!tenant) {
        const match = await resolveTenantByNumber(prisma, payload.To || payload.to);
        if (match) {
            tenant = match.tenant;
            greeting = await prisma.greeting.findUnique({ where: { tenantId: tenant.id } });
            await setCachedTenant(payload.To || payload.to, tenant);
        }
    }

    if (tenant && !isTenantOperational(tenant)) {
        const suspendedTexml = buildGreetingTexml(
            'This organization is temporarily suspended. Please try again later.',
        );
        res.status(200).type('application/xml').send(suspendedTexml);
        setImmediate(() => {
            handleCallLogging(payload, tenant).catch((error) => {
                console.error('❌ Call logging error:', error.message);
            });
        });
        return;
    }

    let phoneRecord = null;
    if (tenant) {
        const dialed = normalizePhoneNumber(payload.To || payload.to);
        if (dialed) {
            phoneRecord = await prisma.phoneNumber.findUnique({ where: { number: dialed } });
            if (phoneRecord && phoneRecord.isActive === false) {
                const suspendedTexml = buildGreetingTexml(
                    'This phone number is temporarily suspended. Please try again later.',
                );
                res.status(200).type('application/xml').send(suspendedTexml);
                setImmediate(() => {
                    handleCallLogging(payload, tenant).catch((error) => {
                        console.error('❌ Call logging error:', error.message);
                    });
                });
                return;
            }
            if (phoneRecord && greeting) {
                greeting = applyNumberRoutingToGreeting(greeting, phoneRecord);
            }
        }
    }

    if (tenant && greeting && requiresCallControlRouting(greeting, phoneRecord)) {
        console.warn('   ↳ Inbound hit TeXML but mobile app routing requires Telnyx Call Control');
        try {
            const callControlSetup = await ensureTelnyxCallControlSetup(prisma);
            if (callControlSetup.numbers?.updated) {
                console.log(`   ↳ Reassigned ${callControlSetup.numbers.updated} number(s) to Call Control — caller should retry`);
            }
        } catch (syncError) {
            console.warn('   ↳ Could not reassign number to Call Control:', syncError.message);
        }
        const retryTexml = buildSayAndHangupTexml(
            'This line is connecting to the mobile app. Please hang up and call again in a few seconds.',
        );
        res.status(200).type('application/xml').send(retryTexml);
        setImmediate(() => {
            handleCallLogging(payload, tenant).catch((error) => {
                console.error('❌ Call logging error:', error.message);
            });
        });
        return;
    }

    const webhookUrl = `${getPublicWebhookBase(req)}/webhook`;
    const voicemailRecordingActionUrl = getVoicemailRecordingActionUrl(req);
    const callRecordingCallbackUrl = getCallRecordingCallbackUrl(req);

    const texmlResponse = tenant
        ? buildInboundCallTexml({
            tenant,
            greeting,
            payload,
            webhookUrl,
            voicemailRecordingActionUrl,
            callRecordingCallbackUrl,
        })
        : buildGreetingTexml('Welcome to V S P V O I P. Your call is connected.');

    if (tenant) {
        console.log('   ↳ Routed to tenant:', tenant.name);
    } else {
        console.log('   ↳ No tenant found — default greeting');
    }

    console.log('   ↳ Sending greeting TeXML');
    res.status(200).type('application/xml').send(texmlResponse);

    setImmediate(() => {
        handleCallLogging(payload, tenant).catch((error) => {
            console.error('❌ Call logging error:', error.message);
        });
    });
}

async function handleCallLogging(payload, cachedTenant) {
    const prisma = await getPrisma();

    if (getTenantCacheSize() === 0) {
        await refreshTenantCache(prisma);
    }

    let tenant = cachedTenant ?? await getCachedTenant(payload.To || payload.to);
    if (!tenant) {
        const phoneRecord = await resolveTenantByNumber(prisma, payload.To || payload.to);
        tenant = phoneRecord?.tenant ?? null;
        if (tenant && phoneRecord) {
            await setCachedTenant(phoneRecord.number, tenant);
        }
    }

    await logCall(prisma, payload, tenant?.id ?? null);
}

async function handleTelnyxStatus(req, res) {
    const payload = req.method === 'GET' ? req.query : req.body;
    const status = payload.CallStatus || payload.call_status || '(none)';
    console.log('📞 Call status event:', status);

    if (['completed', 'busy', 'failed', 'no-answer', 'canceled', 'cancelled'].includes(String(status).toLowerCase())) {
        await clearGreetingSession(payload.From || payload.from, payload.To || payload.to);
    }

    const prisma = await getPrisma();
    await logCall(
        prisma,
        payload,
        null
    );

    res.status(200).send('');
}

async function handleTelnyxVoicemailWebhook(req, res) {
    const payload = req.method === 'GET' ? req.query : req.body;
    console.log('📼 Voicemail recording callback');
    console.log('   From:', payload.From || payload.from);
    console.log('   To:', payload.To || payload.to);
    console.log('   RecordingUrl:', payload.RecordingUrl || payload.recording_url || '(none)');

    try {
        const prisma = await getPrisma();
        const saved = await saveVoicemailFromPayload(prisma, payload);
        if (saved) {
            console.log('   ↳ Voicemail saved:', saved.id);
        }
    } catch (error) {
        console.error('❌ Voicemail save error:', error.message);
    }

    res.status(200).type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="en-US">Thank you for your message. Goodbye.</Say>
  <Hangup/>
</Response>`);
}

async function handleTelnyxCallRecordingWebhook(req, res) {
    const eventType = req.body?.data?.event_type;

    if (eventType === 'call.recording.saved') {
        const payload = req.body?.data?.payload;
        console.log('🎙️ Outbound / Call Control recording saved');
        console.log('   Recording ID:', payload?.recording_id || '(none)');
        console.log('   Call control ID:', payload?.call_control_id || '(none)');

        try {
            const prisma = await getPrisma();
            const saved = await handleCallControlRecordingWebhook(prisma, req.body);
            if (saved) {
                console.log('   ↳ Call recording saved:', saved.id, `(${saved.direction})`);
            }
        } catch (error) {
            console.error('❌ Call recording save error:', error.message);
        }

        res.status(200).json({ received: true });
        return;
    }

    const payload = req.method === 'GET' ? req.query : req.body;
    console.log('🎙️ Call recording callback');
    console.log('   From:', payload.From || payload.from);
    console.log('   To:', payload.To || payload.to);
    console.log('   RecordingStatus:', payload.RecordingStatus || payload.recording_status || '(none)');
    console.log('   RecordingUrl:', payload.RecordingUrl || payload.recording_url || '(none)');

    try {
        const prisma = await getPrisma();
        const saved = await saveCallRecordingFromPayload(prisma, payload);
        if (saved) {
            console.log('   ↳ Call recording saved:', saved.id);
        }
    } catch (error) {
        console.error('❌ Call recording save error:', error.message);
    }

    res.status(200).send('');
}

async function handleTelnyxCallControlWebhook(req, res) {
    const dedup = await evaluateTelnyxWebhookDedup(req.body, { source: 'call-control' });
    const eventType = dedup.eventType;
    console.log('📲 Call Control webhook:', eventType);

    if (!dedup.process) {
        return res.status(200).json({ received: true, duplicate: true });
    }

    res.status(200).json({ received: true });

    setImmediate(async () => {
        try {
            const prisma = await getPrisma();
            if (eventType === 'call.recording.saved') {
                await handleCallControlRecordingWebhook(prisma, req.body);
                return;
            }
            await handleInboundCallControlEvent(prisma, req.body, { webhookSource: 'call-control' });
        } catch (error) {
            const telnyxDetail = error.telnyx?.errors?.[0]?.detail;
            console.error('❌ Call Control handler error:', telnyxDetail || error.message);
        }
    });
}

async function handleTelnyxVoiceWebhook(req, res) {
    const dedup = await evaluateTelnyxWebhookDedup(req.body, { source: 'voice' });
    const eventType = dedup.eventType;
    console.log('📡 Telnyx voice event:', eventType);

    if (!dedup.process) {
        return res.status(200).json({ received: true, duplicate: true });
    }

    res.status(200).json({ received: true });

    setImmediate(async () => {
        try {
            const prisma = await getPrisma();
            if (eventType === 'call.recording.saved') {
                const saved = await handleCallControlRecordingWebhook(prisma, req.body);
                if (saved) {
                    console.log('   ↳ Call recording saved:', saved.id, `(${saved.direction})`);
                }
                return;
            }
            if (
                typeof eventType === 'string'
                && eventType.startsWith('call.')
                && eventType !== 'call.recording.saved'
            ) {
                await handleInboundCallControlEvent(prisma, req.body, { webhookSource: 'voice' });
            }
            const quality = await handleTelnyxVoiceTelemetryEvent(prisma, req.body);
            if (quality) {
                console.log('   ↳ Call quality sample saved:', quality.id, `MOS ${quality.mosInbound ?? quality.mosOutbound}`);
            }
        } catch (error) {
            console.error('❌ Voice webhook handler error:', error.message);
        }
    });
}

// Call logs are served via authenticated portal route: GET /api/calls
// Number search/assign: authenticated portal + admin routes only

const webhookMiddleware = [parseTelnyxFormBody, verifyTelnyxWebhookMiddleware];

// 5. TELNYX INBOUND CALL WEBHOOK
app.get('/webhook', ...webhookMiddleware, (req, res) => {
    handleTelnyxWebhook(req, res).catch((error) => {
        console.error('❌ Webhook error:', error.message);
        res.status(500).send('');
    });
});
app.post('/webhook', ...webhookMiddleware, (req, res) => {
    handleTelnyxWebhook(req, res).catch((error) => {
        console.error('❌ Webhook error:', error.message);
        res.status(500).send('');
    });
});
app.get('/webhook/status', ...webhookMiddleware, (req, res) => {
    handleTelnyxStatus(req, res).catch((error) => {
        console.error('❌ Status webhook error:', error.message);
        res.status(500).send('');
    });
});
app.post('/webhook/status', ...webhookMiddleware, (req, res) => {
    handleTelnyxStatus(req, res).catch((error) => {
        console.error('❌ Status webhook error:', error.message);
        res.status(500).send('');
    });
});
app.get('/webhook/voicemail', ...webhookMiddleware, (req, res) => {
    handleTelnyxVoicemailWebhook(req, res).catch((error) => {
        console.error('❌ Voicemail webhook error:', error.message);
        res.status(500).send('');
    });
});
app.post('/webhook/voicemail', ...webhookMiddleware, (req, res) => {
    handleTelnyxVoicemailWebhook(req, res).catch((error) => {
        console.error('❌ Voicemail webhook error:', error.message);
        res.status(500).send('');
    });
});
app.get('/webhook/call-recording', ...recordingWebhookMiddleware, (req, res) => {
    handleTelnyxCallRecordingWebhook(req, res).catch((error) => {
        console.error('❌ Call recording webhook error:', error.message);
        res.status(500).send('');
    });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, async () => {
    const publicBase = process.env.API_PUBLIC_URL?.trim()?.replace(/\/$/, '')
        || `http://localhost:${PORT}`;
    logger.info('server_started', { port: PORT, production: envConfig.isProduction, publicBase });
    console.log(`🚀 VSP-VOIP Server running on port ${PORT}`);
    console.log(`📞 Webhook: ${publicBase}/webhook`);
    try {
        const prisma = await getPrisma();
        const cacheCount = await refreshTenantCache(prisma);
        console.log(`📋 Loaded ${cacheCount} tenant number(s) into cache`);
    } catch (error) {
        console.warn('⚠️ Could not preload tenant cache:', error.message);
        if (/does not exist|column|migrate/i.test(String(error.message))) {
            console.warn('💡 Database schema may be behind Prisma. Run: npx prisma migrate deploy');
        }
    }

    try {
        const prisma = await getPrisma();
        console.log('💡 Telnyx webhook URLs (use these in Mission Control):');
        console.log(`   TeXML inbound:     ${publicBase}/webhook`);
        console.log(`   Call status:     ${publicBase}/webhook/status`);
        console.log(`   Call Control:    ${publicBase}/webhook/call-control`);
        console.log(`   SMS:             ${publicBase}/webhook/sms`);
        console.log(`   Voice/recording: ${publicBase}/webhook/voice`);
        console.log(`   Call recordings: ${publicBase}/webhook/call-recording`);
        const setup = await ensureTelnyxRecordingSetup(prisma);
        const messagingSetup = await ensureTelnyxMessagingSetup(prisma);
        const callControlSetup = await ensureTelnyxCallControlSetup(prisma);
        if (setup.outboundRecording?.updated) {
            console.log('✅ Outbound voice profile auto-recording enabled');
        }
        if (callControlSetup.numbers?.updated) {
            console.log(`✅ Assigned ${callControlSetup.numbers.updated} phone number(s) to Call Control app`);
        }
        if (process.env.API_PUBLIC_URL) {
            if (setup.webhook?.updated) {
                console.log(`✅ Credential connection webhook set to ${setup.webhook.webhookUrl}`);
            }
            if (messagingSetup.webhook?.updated) {
                console.log(`✅ Messaging profile webhook set to ${messagingSetup.webhook.webhookUrl}`);
            }
            if (callControlSetup.webhook?.updated) {
                console.log(`✅ Call Control webhook set to ${callControlSetup.webhook.webhookUrl}`);
            }
            console.log('💡 MOS telemetry: captured from call.hangup webhooks (Call Control + /webhook/voice)');
            console.log('💡 SIP registration: polled from Telnyx + softphone presence heartbeat');
        } else {
            console.log('💡 Set API_PUBLIC_URL in .env (public EC2 IP or domain) so Telnyx can deliver webhooks');
            console.log('💡 Without API_PUBLIC_URL, inbound mobile calls cannot ring until webhooks are reachable');
        }
        startVoiceTelemetryMonitor(prisma, loadPlatformSettings);

        const expiredGrace = await expireBillingGracePeriods(prisma);
        if (expiredGrace) {
            logger.info('billing_grace_expired', { count: expiredGrace });
        }
        setInterval(() => {
            expireBillingGracePeriods(prisma).catch((err) => {
                logger.error('billing_grace_job_failed', { error: err.message });
            });
        }, 60 * 60 * 1000);

        startBillingIntegrityScheduler();
    } catch (error) {
        console.warn('⚠️ Telnyx startup setup failed (API will still run):', error.message);
        if (error.telnyx) {
            console.warn('   ↳ Telnyx response:', JSON.stringify(error.telnyx));
        }
    }
});

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Stop the other server first:`);
        console.error('   Get-NetTCPConnection -LocalPort 3000 | Stop-Process -Id {OwningProcess} -Force');
    } else {
        console.error('❌ Server error:', error.message);
    }
    process.exit(1);
});