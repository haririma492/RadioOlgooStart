import type { CanonicalPlaybackItem, PlaylistItem } from "./types";

type ResolvedPlayback = {
  currentItem: CanonicalPlaybackItem | null;
  offsetSec: number;
};

export function resolvePlaybackPosition(
  items: PlaylistItem[],
  startedAt?: string,
  serverNowIso = new Date().toISOString()
): ResolvedPlayback {
  const normalized = items
    .filter((item) => item && item.url)
    .map((item, index) => ({
      ...item,
      itemIndex: index,
      durationSec: Math.max(1, Math.floor(Number(item.durationSec || 0))),
    }));

  if (!normalized.length) {
    return { currentItem: null, offsetSec: 0 };
  }

  if (!startedAt) {
    return {
      currentItem: {
        ...normalized[0],
        itemStartedAt: undefined,
      },
      offsetSec: 0,
    };
  }

  const startedMs = new Date(startedAt).getTime();
  const serverNowMs = new Date(serverNowIso).getTime();
  if (!Number.isFinite(startedMs) || !Number.isFinite(serverNowMs)) {
    return {
      currentItem: {
        ...normalized[0],
        itemStartedAt: startedAt,
      },
      offsetSec: 0,
    };
  }

  const elapsedSec = Math.max(0, Math.floor((serverNowMs - startedMs) / 1000));
  const totalDuration = normalized.reduce((sum, item) => sum + item.durationSec, 0);

  if (totalDuration <= 0) {
    return {
      currentItem: {
        ...normalized[0],
        itemStartedAt: startedAt,
      },
      offsetSec: 0,
    };
  }

  const cycleOffset = elapsedSec % totalDuration;
  let running = 0;

  for (const item of normalized) {
    const next = running + item.durationSec;
    if (cycleOffset < next) {
      const itemStartedOffset = cycleOffset - running;
      const itemStartedMs = serverNowMs - itemStartedOffset * 1000;
      return {
        currentItem: {
          ...item,
          itemStartedAt: new Date(itemStartedMs).toISOString(),
        },
        offsetSec: itemStartedOffset,
      };
    }
    running = next;
  }

  return {
    currentItem: {
      ...normalized[0],
      itemStartedAt: startedAt,
    },
    offsetSec: 0,
  };
}
