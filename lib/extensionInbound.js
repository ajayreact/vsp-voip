const {
  isDndActive,
  isScheduleForwardActive,
  resolveForwardTargets,
  findExtensionForPhoneRecord,
  formatCallerName,
} = require('./extensionFeatures');
const { evaluateInboundSecurity } = require('./extensionSecurity');

async function resolveActiveForwardRule(extension, tenant, trigger) {
  const forwarding = extension.forwarding;
  if (!forwarding) return null;

  if (trigger === 'always' && forwarding.alwaysEnabled) {
    return {
      type: forwarding.alwaysDestinationType,
      destination: forwarding.alwaysDestination,
    };
  }

  if (trigger === 'schedule' && isScheduleForwardActive(forwarding, tenant.timezone || 'America/New_York')) {
    return {
      type: forwarding.scheduleDestinationType,
      destination: forwarding.scheduleDestination,
    };
  }

  if (trigger === 'busy' && forwarding.busyEnabled) {
    return {
      type: forwarding.busyDestinationType,
      destination: forwarding.busyDestination,
    };
  }

  if (trigger === 'no_answer' && forwarding.noAnswerEnabled) {
    return {
      type: forwarding.noAnswerDestinationType,
      destination: forwarding.noAnswerDestination,
    };
  }

  return null;
}

/**
 * Evaluate DND, forwarding, screening, and security for a target extension.
 * Works for PSTN inbound (phoneRecord) and internal extension dialing (extension entity).
 */
async function resolveExtensionCallPolicy(
  prisma,
  tenant,
  extension,
  from,
  {
    credentialConnectionId,
    trigger = 'inbound',
    phoneRecord = null,
  } = {},
) {
  if (!extension) return null;

  const applySecurity = trigger === 'inbound' || trigger === 'internal';

  if (applySecurity && extension.security) {
    const tenantExtensions = await prisma.extension.findMany({
      where: { tenantId: tenant.id, status: 'ACTIVE' },
      select: { extensionNumber: true },
    });
    const securityCheck = evaluateInboundSecurity(extension.security, from, {
      tenantExtensions,
      timezone: tenant.timezone || 'America/New_York',
    });
    if (!securityCheck.allowed) {
      return {
        extension,
        action: 'block',
        reason: securityCheck.reason || 'Blocked by security policy',
      };
    }
  }

  const timezone = tenant.timezone || 'America/New_York';

  if ((trigger === 'inbound' || trigger === 'internal') && isDndActive(extension, timezone)) {
    if (extension.dndInboundAction === 'FORWARD') {
      const rule = await resolveActiveForwardRule(extension, tenant, 'always')
        || (extension.forwarding?.alwaysEnabled
          ? {
            type: extension.forwarding.alwaysDestinationType,
            destination: extension.forwarding.alwaysDestination,
          }
          : null);
      if (rule?.type && rule?.destination) {
        const targets = await resolveForwardTargets(
          prisma,
          tenant.id,
          rule.type,
          rule.destination,
          credentialConnectionId,
        );
        if (targets.length) {
          return {
            extension,
            action: 'forward',
            reason: extension.dndReason || 'Do not disturb',
            targets,
            ringTimeout: 25,
            strategy: 'simultaneous',
          };
        }
      }
    }
    return {
      extension,
      action: 'voicemail',
      reason: extension.dndReason || 'Do not disturb',
    };
  }

  if (trigger === 'inbound' || trigger === 'internal') {
    const scheduleRule = await resolveActiveForwardRule(extension, tenant, 'schedule');
    if (scheduleRule?.type && scheduleRule?.destination) {
      const targets = await resolveForwardTargets(
        prisma,
        tenant.id,
        scheduleRule.type,
        scheduleRule.destination,
        credentialConnectionId,
      );
      if (targets.length) {
        return {
          extension,
          action: 'forward',
          reason: 'Schedule forward',
          targets,
          ringTimeout: 25,
          strategy: 'simultaneous',
        };
      }
    }

    const alwaysRule = await resolveActiveForwardRule(extension, tenant, 'always');
    if (alwaysRule?.type && alwaysRule?.destination) {
      const targets = await resolveForwardTargets(
        prisma,
        tenant.id,
        alwaysRule.type,
        alwaysRule.destination,
        credentialConnectionId,
      );
      if (targets.length) {
        return {
          extension,
          action: 'forward',
          reason: 'Always forward',
          targets,
          ringTimeout: 25,
          strategy: 'simultaneous',
        };
      }
    }

    if (trigger === 'inbound' && extension.callScreeningEnabled) {
      return {
        extension,
        action: 'screen',
        callerDisplayName: formatCallerName(from, phoneRecord),
      };
    }
  }

  if (trigger === 'busy' || trigger === 'no_answer') {
    const rule = await resolveActiveForwardRule(extension, tenant, trigger);
    if (rule?.type && rule?.destination) {
      const targets = await resolveForwardTargets(
        prisma,
        tenant.id,
        rule.type,
        rule.destination,
        credentialConnectionId,
      );
      if (targets.length) {
        return {
          extension,
          action: 'forward',
          reason: trigger === 'busy' ? 'Busy forward' : 'No answer forward',
          targets,
          ringTimeout: 25,
          strategy: 'simultaneous',
        };
      }
    }
  }

  return { extension, action: 'ring' };
}

async function resolveExtensionInboundPolicy(prisma, tenant, phoneRecord, from, options = {}) {
  const extension = await findExtensionForPhoneRecord(prisma, tenant.id, phoneRecord);
  if (!extension) return null;
  return resolveExtensionCallPolicy(prisma, tenant, extension, from, {
    ...options,
    phoneRecord,
    trigger: options.trigger || 'inbound',
  });
}

async function applyExtensionFallback(session, prisma, trigger) {
  let policy = null;

  if (session.callKind === 'internal' && session.targetExtensionId) {
    const extension = await prisma.extension.findFirst({
      where: { id: session.targetExtensionId, tenantId: session.tenantId },
      include: { forwarding: true, security: true, user: true },
    });
    if (extension) {
      policy = await resolveExtensionCallPolicy(
        prisma,
        session.tenant,
        extension,
        session.from,
        {
          credentialConnectionId: session.credentialConnectionId,
          trigger,
        },
      );
    }
  } else {
    policy = await resolveExtensionInboundPolicy(
      prisma,
      session.tenant,
      session.phoneRecord,
      session.from,
      {
        credentialConnectionId: session.credentialConnectionId,
        trigger,
      },
    );
  }

  if (!policy || policy.action !== 'forward' || !policy.targets?.length) {
    return false;
  }

  session.preResolvedTargets = policy.targets;
  session.ringTimeout = policy.ringTimeout || 25;
  session.ringStrategy = policy.strategy || 'simultaneous';
  session.extensionPolicyReason = policy.reason;
  return true;
}

module.exports = {
  resolveExtensionCallPolicy,
  resolveExtensionInboundPolicy,
  applyExtensionFallback,
  resolveActiveForwardRule,
};
