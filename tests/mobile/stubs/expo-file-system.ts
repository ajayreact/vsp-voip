export const cacheDirectory = '/tmp/vsp-cache/';

export async function downloadAsync(
  _uri: string,
  dest: string,
  _options?: { headers?: Record<string, string> },
) {
  return { uri: dest, status: 200, headers: {}, md5: '' };
}

export async function getInfoAsync(_uri: string) {
  return { exists: true, uri: _uri, size: 0, isDirectory: false };
}
