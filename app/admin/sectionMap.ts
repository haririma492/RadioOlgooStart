// app/admin/sectionMap.ts
import { MediaItem } from "./types";

const DEFAULT_SECTION_GROUPS: Record<string, string[]> = {
  "Video Archives": ["Conference", "Interview", "Workshop", "Lecture", "Panel Discussion"],
  "Single Videos-Songs": ["Pop", "Classical", "Jazz", "Rock", "Traditional", "Folk"],
  "National Anthems": ["Iran", "Canada", "USA", "France", "Germany", "Other"],
  "Photo Albums": [],
  "Live Channels": ["News", "Music", "Entertainment", "Sports"],
  "Social Media Profiles": ["X", "YouTube", "Instagram", "Facebook", "TikTok"],
  "Great-National-Songs-Videos": ["Patriotic", "Historical", "Contemporary"],
  "In-Transition": ["Pending", "Review", "Archive"],
};

export function buildSectionMap(
  items: MediaItem[],
  knownGroups: Record<string, Set<string>>
): Record<string, string[]> {
  const map: Record<string, Set<string>> = {};

  for (const [sec, groups] of Object.entries(knownGroups)) {
    map[sec] = new Set(groups);
  }

  for (const it of items) {
    const sec = (it.section || "").trim();
    if (!sec) continue;

    if (!map[sec]) map[sec] = new Set();
    const grp = (it.group || "").trim();
    if (grp) map[sec].add(grp);
  }

  if (Object.keys(map).length === 0) {
    for (const [sec, groups] of Object.entries(DEFAULT_SECTION_GROUPS)) {
      map[sec] = new Set(groups);
    }
  }

  const result: Record<string, string[]> = {};
  for (const sec of Object.keys(map).sort()) {
    result[sec] = Array.from(map[sec]).sort();
  }
  return result;
}
