export type ExclusiveAudioStopHandler = () => void;

type ExclusiveAudioEntry = {
  id: string;
  stop: ExclusiveAudioStopHandler;
};

const activeByGroup = new Map<string, ExclusiveAudioEntry>();

/**
 * Request exclusive playback within a screen group (e.g. voicemail inbox).
 * Pauses and resets any other player in the same group before granting playback.
 */
export function requestExclusivePlayback(
  group: string,
  playerId: string,
  stop: ExclusiveAudioStopHandler,
): void {
  const current = activeByGroup.get(group);
  if (current && current.id !== playerId) {
    current.stop();
  }
  activeByGroup.set(group, { id: playerId, stop });
}

export function releaseExclusivePlayback(group: string, playerId: string): void {
  const current = activeByGroup.get(group);
  if (current?.id === playerId) {
    activeByGroup.delete(group);
  }
}

export function clearExclusiveAudioGroup(group: string): void {
  const current = activeByGroup.get(group);
  if (current) {
    current.stop();
    activeByGroup.delete(group);
  }
}

export function getActiveExclusivePlayerId(group: string): string | null {
  return activeByGroup.get(group)?.id ?? null;
}

export function countActiveExclusiveGroups(): number {
  return activeByGroup.size;
}

/** @internal Test helper */
export function resetExclusiveAudioSessionForTests(): void {
  activeByGroup.clear();
}
