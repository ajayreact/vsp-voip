import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { EmptyState, VspAttachmentChip, VspPanel } from '../../components';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';

/** Attachment picker UI shell */
export function AttachmentsScreen() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <VspPanel style={styles.panel}>
        <Text style={[styles.title, { color: colors.text }]}>Attachments</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Upload images or documents via POST /api/messages/attachments in the messaging phase.
        </Text>
        <View style={styles.samples}>
          <VspAttachmentChip name="quote.pdf" mimeType="application/pdf" />
          <VspAttachmentChip name="site-photo.jpg" mimeType="image/jpeg" />
        </View>
      </VspPanel>
      <EmptyState
        icon="📎"
        title="No files selected"
        message="Choose a photo or document to include with your message."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  panel: {
    gap: spacing.sm,
  },
  title: {
    ...typography.subtitle,
  },
  hint: {
    ...typography.caption,
  },
  samples: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
