import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { VspSegmentedControl } from '../../components';
import { useTheme } from '../../shared/theme';
import { spacing } from '../../shared/theme';
import { RecentCallsScreen } from './RecentCallsScreen';
import { DialPadScreen } from './DialPadScreen';

export function CallsHubScreen() {
  const { colors } = useTheme();
  const [segment, setSegment] = useState('recent');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <VspSegmentedControl
          options={[
            { key: 'recent', label: 'Recent' },
            { key: 'dial', label: 'Dial pad' },
          ]}
          value={segment}
          onChange={setSegment}
        />
      </View>
      {segment === 'recent' ? <RecentCallsScreen /> : <DialPadScreen />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
});
