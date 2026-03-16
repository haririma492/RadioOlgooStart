type ResolvedPlayback = {
  currentItem: {
    title: string;
    url: string;
    durationSec: number;
    mediaType?: string;
    sourceType?: string;
  } | null;
  offsetSec: number;
};

export function resolvePlaylistPosition(
  items: Array<{
    title: string;
    url: string;
    durationSec: number;
    mediaType?: string;
    sourceType?: string;
  }>,
  startedAt?: string
): ResolvedPlayback {
  if (!startedAt || !items.length) {
    return { currentItem: items[0] ?? null, offsetSec: 0 };
  }

  const validItems = items.map((item) => ({
    ...item,
    durationSec: Math.max(1, Number(item.durationSec || 0)),
  }));

  const totalDuration = validItems.reduce((sum, item) => sum + item.durationSec, 0);
  if (totalDuration <= 0) {
    return { currentItem: validItems[0] ?? null, offsetSec: 0 };
  }

  const elapsedSec = Math.max(
    0,
    Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
  );

  const cycleOffset = elapsedSec % totalDuration;

  let running = 0;
  for (const item of validItems) {
    const next = running + item.durationSec;
    if (cycleOffset < next) {
      return {
        currentItem: item,
        offsetSec: cycleOffset - running,
      };
    }
    running = next;
  }

  return { currentItem: validItems[0] ?? null, offsetSec: 0 };
}