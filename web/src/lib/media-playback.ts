import { getToken } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export async function fetchAuthenticatedAudioUrl(path: string): Promise<string> {
  const token = getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(detail || `Failed to load audio (${res.status})`);
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export function revokeAuthenticatedAudioUrl(objectUrl: string | null | undefined) {
  if (objectUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(objectUrl);
  }
}
