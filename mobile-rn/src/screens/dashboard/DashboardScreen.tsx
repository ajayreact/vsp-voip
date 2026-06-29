import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import {
  AskVspWidget,
  BusinessInsightsSection,
  DailyBriefCard,
  IntelligenceHeader,
  RecommendationCard,
  SmartAiBanner,
} from '../../components/intelligence';
import { EmptyState } from '../../components/Card';
import { FriendlyError } from '../../components/ui/FriendlyError';
import { FadeInView } from '../../components/ui/FadeInView';
import { RipplePressable } from '../../components/ui/RipplePressable';
import { Skeleton } from '../../components/ui/SkeletonLoader';
import { VspSectionHeader } from '../../components';
import { fetchDashboardStats } from '../../dashboard';
import { maybeScheduleDailyBriefNotification } from '../../intelligence';
import { VSP_AI_BRANDING } from '../../ai/vspAiBranding';
import { buildNotification, useNotificationsStore } from '../../notifications/notificationsStore';
import { usePreloadMainTabs } from '../../hooks/usePreloadMainTabs';
import { useCallerProfile } from '../../hooks/useCallerProfile';
import { useIntelligenceDashboard } from '../../hooks/useIntelligenceDashboard';
import { useRecentCalls } from '../../hooks/useRecentCalls';
import { useVoicemails } from '../../hooks/useVoicemails';
import { useConversations } from '../../hooks/useConversations';
import { useAppStore } from '../../store/appStore';
import { useTheme } from '../../shared/theme';
import { formatPhone } from '../../utils/format';
import { getFriendlyErrorMessage } from '../../utils/friendlyError';
import { spacing, typography } from '../../shared/theme';
import type { HomeStackParamList, MainTabParamList } from '../../navigation/types';
import type { IntelligenceRecommendation } from '../../intelligence/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'HomeMain'>;

export function DashboardScreen({ navigation }: Props) {
  const profile = useCallerProfile();
  const { colors } = useTheme();
  const setDashboardStats = useAppStore((s) => s.setDashboardStats);
  const notificationUnread = useNotificationsStore((s) => s.unreadCount());
  const tabNavigation = navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();
  usePreloadMainTabs(tabNavigation ?? undefined);

  const [stats, setStats] = useState<Awaited<ReturnType<typeof fetchDashboardStats>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: calls = [], refetch: refetchCalls } = useRecentCalls();
  const { data: voicemails = [], refetch: refetchVoicemails } = useVoicemails();
  const { data: conversations = [], refetch: refetchConversations } = useConversations();

  const { dailyBrief, recommendations, businessInsights, banners } = useIntelligenceDashboard({
    stats,
    calls: stats?.recentCalls?.length ? stats.recentCalls : calls,
    voicemails,
    conversations,
  });

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchDashboardStats();
      setStats(data);
      setDashboardStats(data);

      const upsert = useNotificationsStore.getState().upsert;
      for (const call of data.recentCalls ?? []) {
        if (!(call.status || '').toLowerCase().includes('miss')) continue;
        const peer = call.direction === 'inbound' ? call.from : call.to;
        upsert(
          buildNotification({
            kind: 'missed_call',
            referenceId: call.id,
            title: formatPhone(peer),
            body: 'Missed call',
            createdAt: call.createdAt,
            isRead: true,
            deepLink: { screen: 'recent', filter: 'missed' },
          }),
        );
      }
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'dashboard'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setDashboardStats]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!dailyBrief || loading) return;
    void maybeScheduleDailyBriefNotification(dailyBrief);
  }, [dailyBrief, loading]);

  const onRefresh = useCallback(async () => {
    await Promise.all([load(true), refetchCalls(), refetchVoicemails(), refetchConversations()]);
  }, [load, refetchCalls, refetchConversations, refetchVoicemails]);

  const openAskVsp = useCallback(
    (question: string) => {
      tabNavigation?.navigate('AI', {
        screen: 'AssistantHome',
        params: { initialQuestion: question },
      });
    },
    [tabNavigation],
  );

  const openRecommendation = useCallback(
    (item: IntelligenceRecommendation) => {
      const link = item.deepLink;
      if (!link || !tabNavigation) return;
      if (link.tab === 'AI') {
        tabNavigation.navigate('AI', {
          screen: 'AssistantHome',
          params: link.params as { initialQuestion?: string },
        });
        return;
      }
      if (link.screen) {
        tabNavigation.navigate(link.tab, { screen: link.screen, params: link.params } as never);
        return;
      }
      tabNavigation.navigate(link.tab, undefined as never);
    },
    [tabNavigation],
  );

  const bannerRecommendationMap = useMemo(() => {
    const map = new Map<string, IntelligenceRecommendation>();
    for (const banner of banners) {
      if (!banner.recommendationId) continue;
      const rec = recommendations.find((item) => item.id === banner.recommendationId);
      if (rec) map.set(banner.id, rec);
    }
    return map;
  }, [banners, recommendations]);

  const handleBannerPress = useCallback(
    (bannerId: string) => {
      const rec = bannerRecommendationMap.get(bannerId);
      if (rec) openRecommendation(rec);
    },
    [bannerRecommendationMap, openRecommendation],
  );

  const renderRecommendation = useCallback(
    ({ item }: { item: IntelligenceRecommendation }) => (
      <View style={styles.listItem}>
        <RecommendationCard item={item} onPress={openRecommendation} />
      </View>
    ),
    [openRecommendation],
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.content}>
        <View style={styles.topBar}>
          <Text style={[styles.homeTitle, { color: colors.text }]} accessibilityRole="header">
            {VSP_AI_BRANDING.productName}
          </Text>
          <RipplePressable
            onPress={() => navigation.navigate('NotificationsCenter')}
            style={[styles.bellBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel={`Notifications${notificationUnread > 0 ? `, ${notificationUnread} unread` : ''}`}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.primary} />
            {notificationUnread > 0 ? (
              <View style={[styles.bellBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.bellBadgeText}>
                  {notificationUnread > 99 ? '99+' : notificationUnread}
                </Text>
              </View>
            ) : null}
          </RipplePressable>
        </View>

        <IntelligenceHeader
          name={profile.name}
          tenantName={profile.tenantName}
          extension={profile.extension}
          businessDid={profile.businessDid}
          registrationLabel={profile.registrationLabel}
          isRegistered={profile.isRegistered}
        />

        <AskVspWidget onSubmit={openAskVsp} />

        {banners.length > 0 ? (
          <View style={styles.bannerStack}>
            {banners.map((banner) => (
              <SmartAiBanner
                key={banner.id}
                banner={banner}
                onPress={
                  bannerRecommendationMap.has(banner.id)
                    ? () => handleBannerPress(banner.id)
                    : undefined
                }
              />
            ))}
          </View>
        ) : null}

        <DailyBriefCard brief={dailyBrief} loading={loading && !stats} />

        <BusinessInsightsSection insights={businessInsights} />

        {recommendations.length > 0 ? (
          <VspSectionHeader title={VSP_AI_BRANDING.recommendedBy} />
        ) : null}
      </View>
    ),
    [
      bannerRecommendationMap,
      banners,
      businessInsights,
      colors,
      dailyBrief,
      handleBannerPress,
      loading,
      navigation,
      notificationUnread,
      openAskVsp,
      profile.businessDid,
      profile.extension,
      profile.isRegistered,
      profile.name,
      profile.registrationLabel,
      profile.tenantName,
      recommendations.length,
      stats,
    ],
  );

  const listEmpty = useMemo(
    () => (
      <View style={styles.emptyWrap}>
        <EmptyState
          icon="✨"
          title="You're caught up"
          message={`${VSP_AI_BRANDING.productName} will surface recommendations as activity arrives.`}
        />
      </View>
    ),
    [],
  );

  if (loading && !stats) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <View style={styles.content}>
          <Skeleton height={28} width="70%" />
          <Skeleton height={120} />
          <Skeleton height={96} />
          <Skeleton height={180} />
        </View>
      </View>
    );
  }

  if (error && !stats) {
    return <FriendlyError title="Couldn't load home" message={error} onRetry={() => void load()} />;
  }

  return (
    <FadeInView style={styles.flex}>
      <FlashList
        data={recommendations}
        keyExtractor={(item) => item.id}
        renderItem={renderRecommendation}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        estimatedItemSize={96}
        drawDistance={320}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.primary} />
        }
      />
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md },
  listContent: { paddingBottom: spacing.xxl },
  listItem: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  homeTitle: { ...typography.title, fontWeight: '700' },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  bellBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  bannerStack: { gap: spacing.sm },
  emptyWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
});
