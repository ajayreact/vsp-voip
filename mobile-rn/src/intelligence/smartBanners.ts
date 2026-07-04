import { VSP_AI_BRANDING } from '../ai/vspAiBranding';
import type { DailyBrief, IntelligenceRecommendation, SmartBanner } from './types';

export function buildSmartBanners(
  recommendations: IntelligenceRecommendation[],
  brief: DailyBrief,
): SmartBanner[] {
  const banners: SmartBanner[] = [];

  const urgentVoicemails = recommendations.filter((r) => r.kind === 'urgent_voicemail' && r.priority === 'high');
  if (urgentVoicemails.length > 0) {
    banners.push({
      id: 'banner-urgent-vm',
      message:
        urgentVoicemails.length === 1
          ? `You have 1 urgent voicemail.`
          : `You have ${urgentVoicemails.length} urgent voicemails.`,
      priority: 'high',
      recommendationId: urgentVoicemails[0].id,
    });
  } else if (brief.metrics.voicemails > 0) {
    banners.push({
      id: 'banner-vm',
      message:
        brief.metrics.voicemails === 1
          ? `You have 1 new voicemail.`
          : `You have ${brief.metrics.voicemails} new voicemails.`,
      priority: 'medium',
    });
  }

  const waitingCallbacks = recommendations.filter((r) => r.kind === 'callback_waiting');
  for (const rec of waitingCallbacks.slice(0, 2)) {
    banners.push({
      id: `banner-callback-${rec.id}`,
      message: rec.title.endsWith('.') ? rec.title : `${rec.title}.`,
      priority: 'high',
      recommendationId: rec.id,
    });
  }

  const unanswered = recommendations.filter((r) => r.kind === 'unanswered_message').slice(0, 2);
  for (const rec of unanswered) {
    const name = rec.title.replace(/ sent unread messages$/i, '');
    banners.push({
      id: `banner-msg-${rec.id}`,
      message: `${name} is waiting for your response.`,
      priority: 'medium',
      recommendationId: rec.id,
    });
  }

  if (brief.metrics.missedCalls > 0 && banners.length < 3) {
    banners.push({
      id: 'banner-missed',
      message:
        brief.metrics.missedCalls === 1
          ? 'You have 1 missed call today.'
          : `You have ${brief.metrics.missedCalls} missed calls today.`,
      priority: 'medium',
    });
  }

  return banners.slice(0, 3).map((banner) => ({
    ...banner,
    message: `${VSP_AI_BRANDING.recommendedBy}\n${banner.message}`,
  }));
}
