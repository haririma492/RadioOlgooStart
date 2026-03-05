// app/admin/components/modals/YouTubeImportModal.tsx
"use client";

import React, { useState } from "react";

export function YouTubeImportModal({
  token,
  onClose,
  onStartProgress,
  pushLog,
  allGroupOptions,
  busy,
  setBusy,
}: {
  token: string;
  onClose: () => void;
  onStartProgress: (videos: any[]) => void;
  pushLog: (line: string) => void;
  allGroupOptions: string[];
  busy: boolean;
  setBusy: (busy: boolean) => void;
}) {
  const [channels, setChannels] = useState<Array<{ url: string; group: string }>>([{ url: "", group: "" }]);
  const [fetchedVideos, setFetchedVideos] = useState<any[]>([]);
  const [fetching, setFetching] = useState(false);

  const addChannel = () => setChannels((prev) => [...prev, { url: "", group: "" }]);
  const removeChannel = (index: number) => setChannels((prev) => prev.filter((_, i) => i !== index));
  const updateChannel = (index: number, field: "url" | "group", value: string) => {
    setChannels((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const fetchVideos = async () => {
    const validChannels = channels.filter((ch) => ch.url.trim() && ch.group.trim());
    if (validChannels.length === 0) {
      alert("Please enter at least one channel URL with a group selected");
      return;
    }

    setFetching(true);
    setBusy(true);
    setFetchedVideos([]);

    try {
      pushLog(`Fetching videos from ${validChannels.length} channel(s)...`);
      const response = await fetch("/api/admin/youtube/fetch-videos", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ channels: validChannels }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const msg = data?.error || "Failed to fetch videos";
        throw new Error(msg);
      }

      setFetchedVideos(data?.videos || []);
      pushLog(`✅ Fetched ${(data?.videos || []).length} total videos`);
    } catch (error: any) {
      pushLog(`❌ Error: ${error?.message ?? String(error)}`);
      alert(`Error: ${error?.message ?? String(error)}`);
    } finally {
      setFetching(false);
      setBusy(false);
    }
  };

  const startDownloading = () => {
    if (fetchedVideos.length === 0) {
      alert("No videos to download");
      return;
    }
    onStartProgress(fetchedVideos);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-slate-900">📺 Import Latest Videos from YouTube Channel-s</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <p className="text-sm text-slate-600">
            Enter YouTube channel URLs and select a group for each. Last 5 videos from each channel will be fetched.
          </p>

          {channels.map((channel, index) => (
            <div key={index} className="flex gap-2 items-start">
              <div className="flex-1">
                <input
                  type="text"
                  value={channel.url}
                  onChange={(e) => updateChannel(index, "url", e.target.value)}
                  placeholder="https://www.youtube.com/@ChannelName"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  disabled={fetching || busy}
                />
              </div>

              <div className="w-48">
                <select
                  value={channel.group}
                  onChange={(e) => updateChannel(index, "group", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  disabled={fetching || busy}
                >
                  <option value="">Select Group</option>
                  {allGroupOptions.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
              </div>

              {channels.length > 1 && (
                <button
                  onClick={() => removeChannel(index)}
                  className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                  disabled={fetching || busy}
                  title="Remove channel"
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          <button
            onClick={addChannel}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-sm font-bold transition-colors"
            disabled={fetching || busy}
          >
            ➕ Add Another Channel
          </button>
        </div>

        <div className="flex gap-3 mb-6">
          <button
            onClick={fetchVideos}
            disabled={fetching || busy}
            className="flex-1 px-4 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm transition-colors"
          >
            {fetching ? "⏳ Fetching..." : "🔍 Fetch Videos"}
          </button>
        </div>

        {fetchedVideos.length > 0 && (
          <>
            <div className="mb-4">
              <h3 className="text-lg font-bold text-slate-900 mb-3">📋 Fetched Videos ({fetchedVideos.length})</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {fetchedVideos.map((video, index) => (
                  <div key={index} className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h4 className="font-bold text-sm text-slate-900 mb-1">{video.title}</h4>
                        <div className="text-xs text-slate-600 space-y-1">
                          <div>📺 Channel: {video.channelTitle}</div>
                          <div>📅 Uploaded: {video.uploadDate}</div>
                          <div>👁️ Views: {video.viewCount?.toLocaleString?.() ?? video.viewCount}</div>
                          <div>🏷️ Group: {video.group}</div>
                        </div>
                      </div>
                      <a
                        href={video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 rounded bg-blue-500 text-white text-xs font-bold hover:bg-blue-600 transition-colors"
                      >
                        ▶️ Test
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={startDownloading}
              disabled={fetching || busy}
              className="w-full px-4 py-3 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm transition-colors shadow-lg"
            >
              📥 Start Download & Upload Process
            </button>
          </>
        )}
      </div>
    </div>
  );
}
