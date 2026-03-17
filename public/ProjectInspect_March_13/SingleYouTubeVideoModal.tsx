// app/admin/components/modals/SingleYouTubeVideoModal.tsx
"use client";

import React, { useState } from "react";

export function SingleYouTubeVideoModal({
  token,
  onClose,
  onStartProgress,
  pushLog,
  groups,
  busy,
  setBusy,
  sectionList,
}: {
  token: string;
  onClose: () => void;
  onStartProgress: (video: any) => void;
  pushLog: (line: string) => void;
  groups: string[];
  busy: boolean;
  setBusy: (busy: boolean) => void;
  sectionList: string[];
}) {
  const safeSectionList =
    Array.isArray(sectionList) && sectionList.length ? sectionList : ["Youtube Chanel Videos"];
  const safeGroups = Array.isArray(groups) ? groups : [];

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [group, setGroup] = useState("");
  const [uploadDate, setUploadDate] = useState("");
  const [section, setSection] = useState("Youtube Chanel Videos");

  const start = () => {
    const u = url.trim();
    const t = title.trim();
    const g = group.trim();
    const s = section.trim();

    if (!u) return alert("Please paste a YouTube video link.");
    if (!s) return alert("Please select a section.");
    if (!g) return alert("Please select a group.");
    if (!t) return alert("Please enter a title.");

    const video = {
      url: u,
      title: t,
      group: g,
      section: s,
      uploadDate: uploadDate.trim() || undefined,
    };

    pushLog(`▶️ Single YouTube import queued → ${s} / ${g}`);
    onStartProgress(video);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-slate-900">▶️ Add a Video from YouTube</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-900 font-semibold">
          Note: This uses your existing backend route. It will save into the section you select below.
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Section *</label>
            <select
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              disabled={busy}
            >
              {safeSectionList.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">YouTube video link *</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              disabled={busy}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Group *</label>
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              disabled={busy}
            >
              <option value="">Select Group</option>
              {safeGroups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title saved in DynamoDB"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              disabled={busy}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Upload date (optional)</label>
            <input
              type="date"
              value={uploadDate}
              onChange={(e) => setUploadDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              disabled={busy}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={start}
              disabled={busy || !url.trim() || !group.trim() || !title.trim() || !section.trim()}
              className="flex-1 px-4 py-3 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-black text-sm transition-colors shadow-lg"
            >
              {busy ? "⏳ Working..." : "📥 Download & Upload"}
            </button>
            <button
              onClick={onClose}
              disabled={busy}
              className="px-4 py-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 font-bold text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
