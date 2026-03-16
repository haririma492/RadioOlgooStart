type PlaybackItem = {
  title: string;
  url: string;
  durationSec: number;
  mediaType?: string;
  sourceType?: string;
};

type ResolvedPlayback = {
  currentItem: PlaybackItem | null;
  offsetSec: number;
};

export function resolvePlaybackPosition(
  items: PlaybackItem[],
  startedAt?: string
): ResolvedPlayback {
  const normalized = items
    .filter((item) => item && item.url)
    .map((item) => ({
      ...item,
      durationSec: Math.max(1, Number(item.durationSec || 0)),
    }));

  if (!normalized.length) {
    return { currentItem: null, offsetSec: 0 };
  }

  if (!startedAt) {
    return { currentItem: normalized[0], offsetSec: 0 };
  }

  const startedMs = new Date(startedAt).getTime();
  if (!Number.isFinite(startedMs)) {
    return { currentItem: normalized[0], offsetSec: 0 };
  }

  const elapsedSec = Math.max(0, Math.floor((Date.now() - startedMs) / 1000));
  const totalDuration = normalized.reduce((sum, item) => sum + item.durationSec, 0);

  if (totalDuration <= 0) {
    return { currentItem: normalized[0], offsetSec: 0 };
  }

  const cycleOffset = elapsedSec % totalDuration;

  let running = 0;
  for (const item of normalized) {
    const next = running + item.durationSec;
    if (cycleOffset < next) {
      return {
        currentItem: item,
        offsetSec: cycleOffset - running,
      };
    }
    running = next;
  }

  return { currentItem: normalized[0], offsetSec: 0 };
}