import React from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '../../shared/theme';
import { attachmentUri, formatAttachmentSize } from '../../messaging/format';
import type { MessageAttachment } from '../../messaging/types';
import { spacing, typography } from '../../shared/theme';

type Props = {
  attachment: MessageAttachment;
  visible: boolean;
  onClose: () => void;
};

export function AttachmentPreviewModal({ attachment, visible, onClose }: Props) {
  const { colors } = useTheme();
  const uri = attachmentUri(attachment);
  const isImage = attachment.mimeType?.startsWith('image/');
  const isPdf = attachment.mimeType === 'application/pdf';

  async function openExternal() {
    if (uri) await Linking.openURL(uri).catch(() => {});
  }

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {attachment.fileName || 'Attachment'}
          </Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close preview">
            <Text style={[styles.close, { color: colors.primary }]}>Close</Text>
          </Pressable>
        </View>
        {isImage && uri ? (
          <Image
            source={{ uri }}
            style={styles.image}
            contentFit="contain"
            cachePolicy="memory-disk"
            accessibilityLabel={attachment.fileName || 'Image attachment'}
          />
        ) : (
          <View style={styles.fileBody}>
            <Text style={[styles.fileIcon, { color: colors.primary }]}>{isPdf ? 'PDF' : 'FILE'}</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              {attachment.mimeType || 'Unknown type'}
              {attachment.sizeBytes ? ` · ${formatAttachmentSize(attachment.sizeBytes)}` : ''}
            </Text>
            {uri ? (
              <Pressable onPress={openExternal} style={[styles.openBtn, { borderColor: colors.border }]}>
                <Text style={{ color: colors.primary }}>Open file</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: { ...typography.subtitle, flex: 1, marginRight: spacing.md },
  close: { ...typography.bodyMedium, fontWeight: '700' },
  image: { flex: 1, borderRadius: 12 },
  fileBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  fileIcon: { ...typography.display, fontWeight: '700' },
  meta: { ...typography.caption },
  openBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
});
