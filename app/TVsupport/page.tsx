"use client";

import { useEffect, useMemo, useState } from "react";
import OlgooLivePlayer from "@/components/OlgooLive/OlgooLivePlayer";

type SupportTab = "playlist" | "schedule" | "subtitles" | "live" | "admin";

type PlaylistSummary = {
  playlistId: string;
  name: string;
  itemCount: number;
  totalDurationSec: number;
};

type ScheduleSummary = {
  scheduleId: string;
  name: string;
  blockCount: number;
  status?: string;
};

type ContentItem = {
  PK: string;
  title: string;
  url: string;
  section?: string;
  group?: string;
  person?: string;
  sourceType?: string;
  mediaType?: string;
  durationSec?: number;
};

type PlaylistDraftItem = {
  assetPk?: string;
  title: string;
  url: string;
  durationSec: number;
  sourceType?: string;
  mediaType?: string;
};

type PlaybackState = {
  playState: "playing" | "stopped";
  mediaUrl?: string;
  title?: string;
  startedAt?: string;
  updatedAt?: string;
  sourceScheduleId?: string;
  sourcePlaylistId?: string;
  currentItem?: {
    title: string;
    url: string;
    durationSec: number;
    mediaType?: string;
    sourceType?: string;
  } | null;
  offsetSec?: number;
};

function fmtDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Number(totalSeconds || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function extractYoutubeId(url: string): string | null {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function MediaPreview({ item }: { item: ContentItem }) {
  const url = item.url || "";
  const lower = url.toLowerCase();
  const yt = extractYoutubeId(url);

  if (yt) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
        <iframe
          src={`https://www.youtube.com/embed/${yt}`}
          className="h-full w-full"
          allow="autoplay; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={item.title}
        />
      </div>
    );
  }

  if (/\.(jpg|jpeg|png|webp|gif)$/i.test(lower)) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
        <img src={url} alt={item.title} className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
      <video
        src={url}
        className="h-full w-full object-cover"
        controls
        preload="metadata"
      />
    </div>
  );
}

export default function TVSupportPage() {
  const [activeTab, setActiveTab] = useState<SupportTab>("playlist");

  const [channel] = useState("OLGOO_LIVE");
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [subtitleSet, setSubtitleSet] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);

  const [schedules, setSchedules] = useState<ScheduleSummary[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);

  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [contentSections, setContentSections] = useState<string[]>([]);
  const [contentGroups, setContentGroups] = useState<string[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);

  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
  const [loadingPlaybackState, setLoadingPlaybackState] = useState(false);
  const [activating, setActivating] = useState(false);

  const [contentSectionFilter, setContentSectionFilter] = useState("");
  const [contentGroupFilter, setContentGroupFilter] = useState("");
  const [contentSearch, setContentSearch] = useState("");

  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [draftPlaylistItems, setDraftPlaylistItems] = useState<PlaylistDraftItem[]>([]);
  const [justAddedPk, setJustAddedPk] = useState<string | null>(null);

  const [newScheduleName, setNewScheduleName] = useState("");
  const [selectedPlaylistForSchedule, setSelectedPlaylistForSchedule] = useState("");

  const tabs: Array<{ key: SupportTab; label: string }> = [
    { key: "playlist", label: "Playlist" },
    { key: "schedule", label: "Schedule" },
    { key: "subtitles", label: "Subtitles" },
    { key: "live", label: "Live" },
    { key: "admin", label: "Admin / Backfill" },
  ];

  const playlistTotalSeconds = useMemo(
    () => draftPlaylistItems.reduce((sum, item) => sum + Number(item.durationSec || 0), 0),
    [draftPlaylistItems]
  );

  async function loadPlaylists() {
    setLoadingPlaylists(true);
    try {
      const response = await fetch("/api/olgoo-live/playlists", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || `Failed to load playlists (${response.status})`);
      }

      const rows = Array.isArray(data?.playlists) ? data.playlists : [];
      setPlaylists(rows);
    } catch (error) {
      console.error(error);
      setStatusMessage(error instanceof Error ? error.message : "Could not load playlists.");
    } finally {
      setLoadingPlaylists(false);
    }
  }

  async function loadSchedules() {
    setLoadingSchedules(true);
    try {
      const response = await fetch("/api/olgoo-live/schedules", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || `Failed to load schedules (${response.status})`);
      }

      const rows = Array.isArray(data?.schedules) ? data.schedules : [];
      const normalized: ScheduleSummary[] = rows.map((row: any) => {
        const scheduleId = String(row?.scheduleId || row?.id || "").trim();
        const name =
          String(row?.name || "").trim() ||
          scheduleId ||
          "Untitled schedule";

        return {
          scheduleId,
          name,
          blockCount: Number(row?.blockCount || 0),
          status: row?.status ? String(row.status) : undefined,
        };
      });

      setSchedules(normalized);
    } catch (error) {
      console.error(error);
      setStatusMessage(error instanceof Error ? error.message : "Could not load schedules.");
    } finally {
      setLoadingSchedules(false);
    }
  }

  async function loadPlaybackState() {
    setLoadingPlaybackState(true);
    try {
      const response = await fetch("/api/olgoo-live/state", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || `Failed to load playback state (${response.status})`);
      }

      setPlaybackState(data);
    } catch (error) {
      console.error(error);
      setStatusMessage(error instanceof Error ? error.message : "Could not load playback state.");
    } finally {
      setLoadingPlaybackState(false);
    }
  }

  async function loadContentLibrary() {
    setLoadingContent(true);
    try {
      const params = new URLSearchParams();
      if (contentSectionFilter) params.set("section", contentSectionFilter);
      if (contentGroupFilter) params.set("group", contentGroupFilter);
      if (contentSearch) params.set("search", contentSearch);
      params.set("limit", "120");

      const response = await fetch(`/api/olgoo-live/content?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || `Failed to load content (${response.status})`);
      }

      setContentItems(Array.isArray(data?.items) ? data.items : []);
      setContentSections(Array.isArray(data?.sections) ? data.sections : []);
      setContentGroups(Array.isArray(data?.groups) ? data.groups : []);
    } catch (error) {
      console.error(error);
      setStatusMessage(
        error instanceof Error ? error.message : "Could not load content library."
      );
    } finally {
      setLoadingContent(false);
    }
  }

  useEffect(() => {
    loadPlaylists();
    loadSchedules();
    loadContentLibrary();
    loadPlaybackState();
  }, []);

  async function postControl(action: "start" | "stop" | "refresh") {
    setStatusMessage("");

    try {
      if (action === "start") {
        setActivating(true);
      }

      const response = await fetch("/api/olgoo-live/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          channel,
          scheduleId: selectedScheduleId || undefined,
          subtitleSetId: subtitleSet || undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || `Request failed (${response.status})`);
      }

      setStatusMessage(data?.message || `${action} succeeded.`);
      await loadPlaybackState();
    } catch (error) {
      console.error(error);
      setStatusMessage(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setActivating(false);
    }
  }

  async function savePlaylist() {
    if (!newPlaylistName.trim()) {
      setStatusMessage("Playlist name is required.");
      return;
    }

    if (!draftPlaylistItems.length) {
      setStatusMessage("Add at least one content item to the playlist.");
      return;
    }

    try {
      const response = await fetch("/api/olgoo-live/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newPlaylistName, items: draftPlaylistItems }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || `Failed to save playlist (${response.status})`);
      }

      setStatusMessage("Playlist saved.");
      setNewPlaylistName("");
      setDraftPlaylistItems([]);
      await loadPlaylists();
    } catch (error) {
      console.error(error);
      setStatusMessage(error instanceof Error ? error.message : "Could not save playlist.");
    }
  }

  async function saveSchedule() {
    if (!newScheduleName.trim()) {
      setStatusMessage("Schedule name is required.");
      return;
    }

    if (!selectedPlaylistForSchedule) {
      setStatusMessage("Select a playlist first.");
      return;
    }

    try {
      const response = await fetch("/api/olgoo-live/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newScheduleName,
          playlistId: selectedPlaylistForSchedule,
          channelId: channel,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || `Failed to save schedule (${response.status})`);
      }

      setStatusMessage("Schedule saved.");
      setNewScheduleName("");
      setSelectedPlaylistForSchedule("");
      await loadSchedules();
    } catch (error) {
      console.error(error);
      setStatusMessage(error instanceof Error ? error.message : "Could not save schedule.");
    }
  }

  function addContentToDraft(item: ContentItem) {
    setDraftPlaylistItems((prev) => [
      ...prev,
      {
        assetPk: item.PK,
        title: item.title,
        url: item.url,
        durationSec: Number(item.durationSec || 0) > 0 ? Number(item.durationSec) : 300,
        sourceType: item.sourceType,
        mediaType: item.mediaType,
      },
    ]);

    setJustAddedPk(item.PK);
    setStatusMessage(`Added "${item.title}" to draft playlist.`);

    window.setTimeout(() => {
      setJustAddedPk((current) => (current === item.PK ? null : current));
    }, 1200);
  }

  function removeDraftItem(index: number) {
    setDraftPlaylistItems((prev) => prev.filter((_, i) => i !== index));
  }

  function moveDraftItem(index: number, direction: -1 | 1) {
    setDraftPlaylistItems((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  const activateDisabled = !selectedScheduleId || activating;

  return (
    <main className="min-h-screen bg-[#06122f] text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 border-b border-white/10 pb-5">
          <h1 className="mb-2 text-4xl font-bold">TV Support</h1>
          <p className="text-lg text-white/80">
            React / TypeScript shell replacing the old Streamlit control console.
          </p>
        </div>

        <div className="mb-6 flex flex-wrap gap-3 border-b border-white/10 pb-4">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={[
                  "rounded-full border px-6 py-3 text-xl font-semibold transition",
                  isActive
                    ? "border-blue-400 bg-blue-600 text-white"
                    : "border-white/20 bg-transparent text-white hover:bg-white/5",
                ].join(" ")}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {statusMessage && (
          <div className="mb-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white/85">
            {statusMessage}
          </div>
        )}

        {activeTab === "playlist" && (
          <section className="space-y-6">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
              <div className="space-y-6">
                <div className="rounded-[24px] border border-white/10 bg-[#071736] p-5 shadow-2xl">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-2xl font-bold">Create playlist</h2>
                    <div className="text-sm text-white/70">
                      {draftPlaylistItems.length} items ΓÇó {fmtDuration(playlistTotalSeconds)}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-base font-semibold">Playlist name</label>
                      <input
                        value={newPlaylistName}
                        onChange={(e) => setNewPlaylistName(e.target.value)}
                        placeholder="e.g. WorldMusic3"
                        className="w-full rounded-2xl border border-white/15 bg-[#091a44] px-4 py-3 text-lg text-white placeholder:text-white/35 outline-none"
                      />
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={savePlaylist}
                        disabled={!newPlaylistName.trim() || draftPlaylistItems.length === 0}
                        className="rounded-2xl border border-white/15 bg-[#1a2f63] px-5 py-3 text-lg font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Save playlist
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDraftPlaylistItems([]);
                          setNewPlaylistName("");
                        }}
                        className="rounded-2xl border border-white/15 bg-transparent px-5 py-3 text-lg font-semibold text-white"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-[#071736] p-5 shadow-2xl">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-2xl font-bold">Draft items</h2>
                    <span className="text-sm text-white/60">
                      {draftPlaylistItems.length === 0 ? "empty" : `${draftPlaylistItems.length} added`}
                    </span>
                  </div>

                  {draftPlaylistItems.length === 0 ? (
                    <div className="text-base text-white/65">Add videos from the content library.</div>
                  ) : (
                    <div className="space-y-3">
                      {draftPlaylistItems.map((item, index) => (
                        <div
                          key={`${item.assetPk || item.url}-${index}`}
                          className="rounded-2xl border border-white/10 bg-[#091a44] p-3"
                        >
                          <div className="line-clamp-2 text-base font-semibold">{item.title}</div>
                          <div className="mt-1 text-sm text-white/60">
                            {fmtDuration(item.durationSec)} ΓÇó {item.mediaType || "video"}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => moveDraftItem(index, -1)}
                              className="rounded-xl border border-white/15 bg-[#1a2f63] px-3 py-2 text-sm font-semibold"
                            >
                              Up
                            </button>
                            <button
                              type="button"
                              onClick={() => moveDraftItem(index, 1)}
                              className="rounded-xl border border-white/15 bg-[#1a2f63] px-3 py-2 text-sm font-semibold"
                            >
                              Down
                            </button>
                            <button
                              type="button"
                              onClick={() => removeDraftItem(index)}
                              className="rounded-xl border border-white/15 bg-[#5a2230] px-3 py-2 text-sm font-semibold"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-[24px] border border-white/10 bg-[#071736] p-5 shadow-2xl">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-2xl font-bold">Saved playlists</h2>
                    <button
                      type="button"
                      onClick={loadPlaylists}
                      className="rounded-2xl border border-white/15 bg-[#1a2f63] px-4 py-3 text-base font-semibold"
                    >
                      Refresh
                    </button>
                  </div>

                  {loadingPlaylists ? (
                    <div className="text-base text-white/70">Loading playlistsΓÇª</div>
                  ) : (
                    <div className="space-y-3">
                      {playlists.length === 0 ? (
                        <div className="text-base text-white/70">No playlists found.</div>
                      ) : (
                        playlists.map((playlist) => (
                          <div
                            key={playlist.playlistId}
                            className="rounded-2xl border border-white/10 bg-white/5 p-4"
                          >
                            <div className="text-xl font-bold">{playlist.name}</div>
                            <div className="mt-2 text-sm text-white/70">
                              {playlist.itemCount} items ΓÇó {fmtDuration(playlist.totalDurationSec)}
                            </div>
                            <div className="mt-2 text-sm text-white/45">
                              ID: {playlist.playlistId}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-[#071736] p-5 shadow-2xl">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-2xl font-bold">Content library</h2>
                  <button
                    type="button"
                    onClick={loadContentLibrary}
                    className="rounded-2xl border border-white/15 bg-[#1a2f63] px-4 py-3 text-base font-semibold"
                  >
                    Refresh
                  </button>
                </div>

                <div className="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Section</label>
                    <select
                      value={contentSectionFilter}
                      onChange={(e) => setContentSectionFilter(e.target.value)}
                      className="w-full rounded-2xl border border-white/15 bg-[#091a44] px-4 py-3 text-base text-white outline-none"
                    >
                      <option value="">All sections</option>
                      {contentSections.map((section) => (
                        <option key={section} value={section}>
                          {section}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Group</label>
                    <select
                      value={contentGroupFilter}
                      onChange={(e) => setContentGroupFilter(e.target.value)}
                      className="w-full rounded-2xl border border-white/15 bg-[#091a44] px-4 py-3 text-base text-white outline-none"
                    >
                      <option value="">All groups</option>
                      {contentGroups.map((group) => (
                        <option key={group} value={group}>
                          {group}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2 lg:col-span-2">
                    <label className="text-sm font-semibold">Search</label>
                    <div className="flex gap-3">
                      <input
                        value={contentSearch}
                        onChange={(e) => setContentSearch(e.target.value)}
                        placeholder="title / person / section"
                        className="w-full rounded-2xl border border-white/15 bg-[#091a44] px-4 py-3 text-base text-white placeholder:text-white/35 outline-none"
                      />
                      <button
                        type="button"
                        onClick={loadContentLibrary}
                        className="rounded-2xl border border-white/15 bg-[#1a2f63] px-4 py-3 text-base font-semibold"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>

                {loadingContent ? (
                  <div className="text-base text-white/70">Loading content libraryΓÇª</div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {contentItems.length === 0 ? (
                      <div className="text-base text-white/70">No content items found.</div>
                    ) : (
                      contentItems.map((item) => {
                        const justAdded = justAddedPk === item.PK;
                        return (
                          <div
                            key={item.PK}
                            className="overflow-hidden rounded-2xl border border-white/10 bg-[#091a44]"
                          >
                            <div className="grid grid-cols-1 gap-0 md:grid-cols-[220px_minmax(0,1fr)]">
                              <div className="p-3">
                                <MediaPreview item={item} />
                              </div>

                              <div className="flex min-w-0 flex-col justify-between p-4">
                                <div>
                                  <div className="line-clamp-2 text-lg font-semibold">
                                    {item.title}
                                  </div>
                                  <div className="mt-2 text-sm text-white/65">
                                    {item.section || "ΓÇö"} ΓÇó {item.group || "ΓÇö"} ΓÇó {item.person || "ΓÇö"}
                                  </div>
                                  <div className="mt-1 text-sm text-white/50">
                                    {fmtDuration(Number(item.durationSec || 0))} ΓÇó {item.mediaType || "video"}
                                  </div>
                                </div>

                                <div className="mt-4">
                                  <button
                                    type="button"
                                    onClick={() => addContentToDraft(item)}
                                    className={[
                                      "rounded-2xl border px-5 py-3 text-base font-semibold transition",
                                      justAdded
                                        ? "border-emerald-400 bg-emerald-600 text-white"
                                        : "border-white/15 bg-[#1a2f63] text-white",
                                    ].join(" ")}
                                  >
                                    {justAdded ? "Added" : "Add"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {activeTab === "schedule" && (
          <section className="space-y-6">
            <div className="rounded-[24px] border border-white/10 bg-[#071736] p-5 shadow-2xl">
              <h2 className="mb-4 text-2xl font-bold">Create schedule</h2>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-base font-semibold">Schedule name</label>
                  <input
                    value={newScheduleName}
                    onChange={(e) => setNewScheduleName(e.target.value)}
                    placeholder="e.g. Evening_Block"
                    className="w-full rounded-2xl border border-white/15 bg-[#091a44] px-4 py-3 text-lg text-white placeholder:text-white/35 outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-base font-semibold">Source playlist</label>
                  <select
                    value={selectedPlaylistForSchedule}
                    onChange={(e) => setSelectedPlaylistForSchedule(e.target.value)}
                    className="w-full rounded-2xl border border-white/15 bg-[#091a44] px-4 py-3 text-lg text-white outline-none"
                  >
                    <option value="">Select playlist</option>
                    {playlists.map((playlist) => (
                      <option key={playlist.playlistId} value={playlist.playlistId}>
                        {playlist.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-5">
                <button
                  type="button"
                  onClick={saveSchedule}
                  disabled={!newScheduleName.trim() || !selectedPlaylistForSchedule}
                  className="rounded-2xl border border-white/15 bg-[#1a2f63] px-5 py-3 text-lg font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Save schedule
                </button>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-[#071736] p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-2xl font-bold">Saved schedules</h2>
                <button
                  type="button"
                  onClick={loadSchedules}
                  className="rounded-2xl border border-white/15 bg-[#1a2f63] px-4 py-3 text-base font-semibold"
                >
                  Refresh
                </button>
              </div>

              {loadingSchedules ? (
                <div className="text-base text-white/70">Loading schedulesΓÇª</div>
              ) : (
                <div className="space-y-3">
                  {schedules.length === 0 ? (
                    <div className="text-base text-white/70">No schedules found.</div>
                  ) : (
                    schedules.map((schedule) => (
                      <div
                        key={schedule.scheduleId || schedule.name}
                        className="rounded-2xl border border-white/10 bg-white/5 p-4"
                      >
                        <div className="text-xl font-bold">{schedule.name}</div>
                        <div className="mt-2 text-sm text-white/75">
                          {schedule.blockCount} blocks
                          {schedule.status ? ` ΓÇó ${schedule.status}` : ""}
                        </div>
                        <div className="mt-2 text-sm text-white/45">
                          ID: {schedule.scheduleId || "ΓÇö"}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === "live" && (
          <section>
            <h2 className="mb-6 text-3xl font-bold">Live</h2>

            <div className="space-y-6">
              <div className="rounded-[24px] border border-white/10 bg-[#071736] p-5 shadow-2xl">
                <h3 className="mb-2 text-2xl font-bold">Live Control</h3>
                <p className="mb-6 text-base text-white/70">
                  React shell for the old Streamlit Live tab.
                </p>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-base font-semibold text-white">Channel</label>
                    <div className="w-full rounded-2xl border border-white/15 bg-[#091a44] px-4 py-3 text-lg text-white/70">
                      {channel}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-base font-semibold text-white">Schedule to control</label>
                    <select
                      value={selectedScheduleId}
                      onChange={(e) => setSelectedScheduleId(e.target.value)}
                      className="w-full rounded-2xl border border-white/15 bg-[#091a44] px-4 py-3 text-lg text-white outline-none"
                    >
                      <option value="">
                        {loadingSchedules ? "Loading schedules..." : "Select saved schedule"}
                      </option>
                      {schedules.map((schedule) => (
                        <option key={schedule.scheduleId || schedule.name} value={schedule.scheduleId}>
                          {schedule.name}
                        </option>
                      ))}
                    </select>
                    {activateDisabled && (
                      <p className="text-sm text-white/55">
                        Select a saved schedule first to enable activation.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-base font-semibold text-white">Subtitle set</label>
                    <input
                      value={subtitleSet}
                      onChange={(e) => setSubtitleSet(e.target.value)}
                      placeholder="Active overlay / video-linked set"
                      className="w-full rounded-2xl border border-white/15 bg-[#091a44] px-4 py-3 text-lg text-white placeholder:text-white/35 outline-none"
                    />
                  </div>

                  <div className="flex flex-wrap gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => postControl("start")}
                      disabled={activateDisabled}
                      className={[
                        "rounded-2xl border border-white/15 px-5 py-3 text-lg font-semibold text-white transition",
                        activateDisabled
                          ? "cursor-not-allowed bg-[#1a2f63] opacity-50"
                          : activating
                          ? "scale-95 bg-emerald-600"
                          : "bg-[#1a2f63] active:scale-95",
                      ].join(" ")}
                    >
                      {activating ? "Activating..." : "Make Active"}
                    </button>

                    <button
                      type="button"
                      onClick={() => postControl("stop")}
                      className="rounded-2xl border border-white/15 bg-[#1a2f63] px-5 py-3 text-lg font-semibold text-white"
                    >
                      Make In-Active
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        loadPlaybackState();
                        setStatusMessage("Playback state refreshed.");
                      }}
                      className="rounded-2xl border border-white/15 bg-[#1a2f63] px-5 py-3 text-lg font-semibold text-white"
                    >
                      Refresh Live Status
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
                <div className="rounded-[24px] border border-white/10 bg-[#071736] p-5 shadow-2xl">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="text-2xl font-bold">Current playback state</h3>
                    <button
                      type="button"
                      onClick={loadPlaybackState}
                      className="rounded-2xl border border-white/15 bg-[#1a2f63] px-4 py-3 text-base font-semibold"
                    >
                      Refresh
                    </button>
                  </div>

                  {loadingPlaybackState ? (
                    <div className="text-base text-white/70">Loading playback stateΓÇª</div>
                  ) : !playbackState ? (
                    <div className="text-base text-white/70">No playback state loaded.</div>
                  ) : (
                    <div className="space-y-3 text-base">
                      <div>
                        <span className="font-semibold">State:</span>{" "}
                        <span className="text-white/80">{playbackState.playState}</span>
                      </div>
                      <div>
                        <span className="font-semibold">Title:</span>{" "}
                        <span className="text-white/80">{playbackState.title || "ΓÇö"}</span>
                      </div>
                      <div className="break-all">
                        <span className="font-semibold">Media URL:</span>{" "}
                        <span className="text-white/80">{playbackState.mediaUrl || "ΓÇö"}</span>
                      </div>
                      <div>
                        <span className="font-semibold">Source schedule:</span>{" "}
                        <span className="text-white/80">{playbackState.sourceScheduleId || "ΓÇö"}</span>
                      </div>
                      <div>
                        <span className="font-semibold">Source playlist:</span>{" "}
                        <span className="text-white/80">{playbackState.sourcePlaylistId || "ΓÇö"}</span>
                      </div>
                      <div>
                        <span className="font-semibold">Started at:</span>{" "}
                        <span className="text-white/80">{playbackState.startedAt || "ΓÇö"}</span>
                      </div>
                      <div>
                        <span className="font-semibold">Updated at:</span>{" "}
                        <span className="text-white/80">{playbackState.updatedAt || "ΓÇö"}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-[24px] border border-white/10 bg-[#071736] p-5 shadow-2xl">
                  <h3 className="mb-4 text-2xl font-bold">Operator preview</h3>
                  {playbackState?.mediaUrl ? (
<OlgooLivePlayer
  mediaUrl={playbackState.currentItem?.url || playbackState.mediaUrl || ""}
  title={playbackState.currentItem?.title || playbackState.title || "Olgoo Live"}
  startAtSec={playbackState.offsetSec || 0}
  liveSync
  autoPlay
  controls
  muted={false}
/>
                  ) : (
                    <div className="flex aspect-video items-center justify-center rounded-2xl bg-black text-white/60">
                      No active playback
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === "subtitles" && (
          <section className="rounded-[24px] border border-white/10 bg-[#071736] p-5 shadow-2xl">
            <h2 className="mb-3 text-2xl font-bold">Subtitles</h2>
            <p className="text-lg text-white/75">
              This tab is reserved for the next migration phase.
            </p>
          </section>
        )}

        {activeTab === "admin" && (
          <section className="rounded-[24px] border border-white/10 bg-[#071736] p-5 shadow-2xl">
            <h2 className="mb-3 text-2xl font-bold">Admin / Backfill</h2>
            <p className="text-lg text-white/75">
              This tab is reserved for the next migration phase.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
