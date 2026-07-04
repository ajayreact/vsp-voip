import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { MAX_ATTACHMENT_BYTES, MAX_MMS_ATTACHMENTS } from './format';
import type { AttachmentUploadInput } from './types';

export type PickResult =
  | { ok: true; files: AttachmentUploadInput[] }
  | { ok: false; error: string };

async function mapAsset(
  uri: string,
  fileName: string,
  mimeType: string,
  sizeBytes?: number,
): Promise<AttachmentUploadInput | null> {
  const size = sizeBytes ?? 0;
  if (size > MAX_ATTACHMENT_BYTES) {
    return null;
  }
  return { uri, fileName, mimeType, sizeBytes: size };
}

export async function pickMessageAttachments(
  remainingSlots: number,
): Promise<PickResult> {
  if (remainingSlots <= 0) {
    return { ok: false, error: `Maximum ${MAX_MMS_ATTACHMENTS} attachments per message.` };
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return { ok: false, error: 'Photo library permission is required to attach files.' };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsMultipleSelection: true,
    selectionLimit: remainingSlots,
    quality: 0.85,
  });

  if (result.canceled || !result.assets.length) {
    return { ok: true, files: [] };
  }

  const files: AttachmentUploadInput[] = [];
  for (const asset of result.assets.slice(0, remainingSlots)) {
    const mapped = await mapAsset(
      asset.uri,
      asset.fileName || `attachment-${Date.now()}`,
      asset.mimeType || 'application/octet-stream',
      asset.fileSize,
    );
    if (!mapped) {
      return { ok: false, error: 'One or more attachments exceed the 5 MB limit.' };
    }
    files.push(mapped);
  }
  return { ok: true, files };
}

export async function pickDocumentAttachments(
  remainingSlots: number,
): Promise<PickResult> {
  if (remainingSlots <= 0) {
    return { ok: false, error: `Maximum ${MAX_MMS_ATTACHMENTS} attachments per message.` };
  }

  const result = await DocumentPicker.getDocumentAsync({
    multiple: true,
    copyToCacheDirectory: true,
    type: ['image/*', 'video/mp4', 'audio/*', 'application/pdf', 'text/plain'],
  });

  if (result.canceled || !result.assets?.length) {
    return { ok: true, files: [] };
  }

  const files: AttachmentUploadInput[] = [];
  for (const asset of result.assets.slice(0, remainingSlots)) {
    const mapped = await mapAsset(
      asset.uri,
      asset.name,
      asset.mimeType || 'application/octet-stream',
      asset.size ?? undefined,
    );
    if (!mapped) {
      return { ok: false, error: `"${asset.name}" exceeds the 5 MB attachment limit.` };
    }
    files.push(mapped);
  }
  return { ok: true, files };
}
