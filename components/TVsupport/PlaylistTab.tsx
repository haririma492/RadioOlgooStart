"use client";

import { useEffect, useMemo, useState } from "react";
import MediaPreview from "./MediaPreview";
import { Panel } from "./shared";

type SlideItem = {
  PK: string;
  title?: string;
  section?: string;
  group?: string;
  person?: string;
  url?: string;
  sourceType?: string;
  mediaType?: string;
  durationSec?: number;
  status?: string;
};

type PlaylistItem = SlideItem;

type SavedPlaylist = {
  playlistId: string;
  name: string;
  itemCount?: number;
  totalDurationSec?: number;
};

function fmtDuration(seconds?: number) {
  const total = Number.isFinite(seconds) ? Number(seconds) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function PlaylistTab() {
  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [savedPlaylists, setSavedPlaylists] = useState<SavedPlaylist[]>([]);
  const [loadingSlides, setLoadingSlides] = useState(false);
  const [playlistName, setPlaylistName] = useState("");
  const [items, setItems] = useState<PlaylistItem[]>([]);
  const [message, setMessage] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [query, setQuery] = useState("");

  async function loadSlides() {
    setLoadingSlides(true);
    setMessage("");
    try {
      const res = await fetch("/api/olgoo-live/slides", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to load slides");
      setSlides(data.items || []);
    } catch (error: any) {
      setMessage(error?.message || "Failed to load slides.");
    } finally {
      setLoadingSlides(false);
    }
  }

  async function loadPlaylists() {
    try {
      const res = await fetch("/api/olgoo-live/playlists", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to load playlists");
      setSavedPlaylists(data.items || []);
    } catch (error: any) {
      setMessage(error?.message || "Failed to load playlists.");
    }
  }

  useEffect(() => {
    loadSlides();
    loadPlaylists();
  }, []);

  const sections = useMemo(
    () => Array.from(new Set(slides.map((item) => item.section).filter(Boolean))).sort(),
    [slides]
  );

  const groups = useMemo(
    () =>
      Array.from(
        new Set(
          slides
            .filter((item) => (!sectionFilter ? true : item.section === sectionFilter))
            .map((item) => item.group)
            .filter(Boolean)
        )
      ).sort(),
    [slides, sectionFilter]
  );

  const filteredSlides = useMemo(() => {
    const q = query.trim().toLowerCase();
    return slides.filter((item) => {
      if (sectionFilter && item.section !== sectionFilter) return false;
      if (groupFilter && item.group !== groupFilter) return false;
      if (!q) return true;
      const hay = [
        item.title,
        item.person,
        item.section,
        item.group,
        item.url,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [slides, sectionFilter, groupFilter, query]);

  function addItem(item: SlideItem) {
    setItems((prev) => [...prev, item]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function moveItem(index: number, direction: -1 | 1) {
    setItems((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function savePlaylist() {
    if (!playlistName.trim()) {
      setMessage("Playlist title is required.");
      return;
    }
    if (items.length === 0) {
      setMessage("Add at least one item to the playlist.");
      return;
    }

    setMessage("Saving playlist...");
    try {
      const res = await fetch("/api/olgoo-live/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: playlistName, items }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to save playlist");
      setMessage(`Saved playlist: ${data.playlistId}`);
      await loadPlaylists();
    } catch (error: any) {
      setMessage(error?.message || "Failed to save playlist.");
    }
  }

  const totalDuration = items.reduce((sum, item) => sum + (Number(item.durationSec) || 0), 0);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20 }}>
      <Panel title="Content Library" subtitle="Loaded from RadioOlgooSlides. Preview any item and add it to the playlist.">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 600 }}>Section</div>
            <select
              value={sectionFilter}
              onChange={(e) => {
                setSectionFilter(e.target.value);
                setGroupFilter("");
              }}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #475569", background: "#111827", color: "#f8fafc" }}
            >
              <option value="">All sections</option>
              {sections.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ marginBottom: 6, fontWeight: 600 }}>Group</div>
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #475569", background: "#111827", color: "#f8fafc" }}
            >
              <option value="">All groups</option>
              {groups.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ marginBottom: 6, fontWeight: 600 }}>Search</div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="title / person / url"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #475569", background: "#111827", color: "#f8fafc" }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 14, display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={loadSlides}
            style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #475569", background: "#1e293b", color: "#f8fafc", fontWeight: 700, cursor: "pointer" }}
          >
            {loadingSlides ? "Refreshing..." : "Refresh Content"}
          </button>
          <div style={{ color: "#94a3b8", fontSize: 13 }}>{filteredSlides.length} items</div>
        </div>

        <div style={{ display: "grid", gap: 14, maxHeight: 900, overflowY: "auto", paddingRight: 4 }}>
          {filteredSlides.map((item) => (
            <div key={item.PK} style={{ border: "1px solid #334155", borderRadius: 14, background: "#111827", padding: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "240px 1fr 120px", gap: 14, alignItems: "start" }}>
                <MediaPreview url={item.url} title={item.title} height={145} />

                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{item.title || "Untitled"}</div>
                  <div style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.7 }}>
                    <div>PK: {item.PK}</div>
                    <div>{item.section || "ΓÇö"} | {item.group || "ΓÇö"} | {item.person || "ΓÇö"}</div>
                    <div>{item.mediaType || "ΓÇö"} | {item.sourceType || "ΓÇö"} | {item.status || "ΓÇö"}</div>
                    <div>{item.url || "ΓÇö"}</div>
                  </div>
                </div>

                <div>
                  <div style={{ marginBottom: 10, fontWeight: 700 }}>{fmtDuration(item.durationSec)}</div>
                  <button
                    onClick={() => addItem(item)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "none", background: "#2563eb", color: "white", fontWeight: 700, cursor: "pointer" }}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          ))}

          {!loadingSlides && filteredSlides.length === 0 ? (
            <div style={{ color: "#94a3b8" }}>No content items matched the current filters.</div>
          ) : null}
        </div>
      </Panel>

      <Panel title="Playlist Builder" subtitle="Selected items can be reordered and saved to RadioOlgooPlaylists.">
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "end", marginBottom: 16 }}>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 600 }}>Playlist title</div>
            <input
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              placeholder="Type a playlist title"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #475569", background: "#111827", color: "#f8fafc" }}
            />
          </div>

          <button
            onClick={savePlaylist}
            style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: "#16a34a", color: "white", fontWeight: 700, cursor: "pointer" }}
          >
            Save Playlist
          </button>
        </div>

        <div style={{ marginBottom: 16, color: "#cbd5e1" }}>
          Total items: <strong>{items.length}</strong> | Total duration: <strong>{fmtDuration(totalDuration)}</strong>
        </div>

        <div style={{ display: "grid", gap: 14, marginBottom: 18 }}>
          {items.map((item, index) => (
            <div key={`${item.PK}-${index}`} style={{ border: "1px solid #334155", borderRadius: 14, background: "#111827", padding: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 160px", gap: 14, alignItems: "start" }}>
                <MediaPreview url={item.url} title={item.title} height={110} />

                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
                    {index + 1}. {item.title || "Untitled"}
                  </div>
                  <div style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.7 }}>
                    <div>{item.section || "ΓÇö"} | {item.group || "ΓÇö"}</div>
                    <div>{item.url || "ΓÇö"}</div>
                    <div>Duration: {fmtDuration(item.durationSec)}</div>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <button
                    disabled={index === 0}
                    onClick={() => moveItem(index, -1)}
                    style={{ padding: "9px 12px", borderRadius: 10, border: "1px solid #475569", background: index === 0 ? "#334155" : "#1e293b", color: "#f8fafc", fontWeight: 700, cursor: index === 0 ? "not-allowed" : "pointer" }}
                  >
                    Move Up
                  </button>
                  <button
                    disabled={index === items.length - 1}
                    onClick={() => moveItem(index, 1)}
                    style={{ padding: "9px 12px", borderRadius: 10, border: "1px solid #475569", background: index === items.length - 1 ? "#334155" : "#1e293b", color: "#f8fafc", fontWeight: 700, cursor: index === items.length - 1 ? "not-allowed" : "pointer" }}
                  >
                    Move Down
                  </button>
                  <button
                    onClick={() => removeItem(index)}
                    style={{ padding: "9px 12px", borderRadius: 10, border: "none", background: "#dc2626", color: "white", fontWeight: 700, cursor: "pointer" }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}

          {items.length === 0 ? (
            <div style={{ color: "#94a3b8" }}>No playlist items selected yet.</div>
          ) : null}
        </div>

        <div style={{ borderTop: "1px solid #334155", paddingTop: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Saved Playlists</div>
          <div style={{ display: "grid", gap: 10 }}>
            {savedPlaylists.map((playlist) => (
              <div key={playlist.playlistId} style={{ border: "1px solid #334155", borderRadius: 12, padding: 12, background: "#111827" }}>
                <div style={{ fontWeight: 700 }}>{playlist.name}</div>
                <div style={{ color: "#94a3b8", fontSize: 13 }}>
                  {playlist.playlistId} | items: {playlist.itemCount || 0} | duration: {fmtDuration(playlist.totalDurationSec)}
                </div>
              </div>
            ))}
            {savedPlaylists.length === 0 ? <div style={{ color: "#94a3b8" }}>No saved playlists yet.</div> : null}
          </div>
        </div>

        {message ? (
          <div style={{ marginTop: 16, color: "#e2e8f0", background: "#0b1220", border: "1px solid #334155", borderRadius: 10, padding: "10px 12px" }}>
            {message}
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
