import React from 'react';
import { ActivityIndicator, Modal, StyleSheet, View } from 'react-native';
import { colors } from '../shared/theme';

type LoadingOverlayProps = {
  visible: boolean;
};

export function LoadingOverlay({ visible }: LoadingOverlayProps) {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.backdrop}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
