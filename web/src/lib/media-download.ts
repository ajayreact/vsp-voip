import { fetchAuthenticatedAudioUrl, revokeAuthenticatedAudioUrl } from '@/lib/media-playback';

export async function downloadAuthenticatedFile(path: string, filename: string) {
  const url = await fetchAuthenticatedAudioUrl(path);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } finally {
    revokeAuthenticatedAudioUrl(url);
  }
}
