// app/admin/components/HeaderSection.tsx
"use client";
import React from "react";

export function HeaderSection({
  authorized,
  busy,
  onRefresh,
  onAddMedia,
  onAddYoutubeBatch,
  onAddYoutubeSingle,
  onScanRegister,
  onMaintain,
}: {
  authorized: boolean;
  busy: boolean;
  onRefresh: () => void;
  onAddMedia: () => void;
  onAddYoutubeBatch: () => void;
  onAddYoutubeSingle: () => void;
  onScanRegister: () => void;
  onMaintain: () => void;
}) {
  return (
    <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Radio Olgoo Admin</h1>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
            authorized ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
          }`}
        >
          {authorized ? "✓ Authorized" : "🔒 Locked"}
        </span>

        <button
          className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-xs transition-colors shadow-sm"
          onClick={onRefresh}
          disabled={!authorized || busy}
        >
          ↻ Refresh
        </button>

        {authorized && (
          <>
            <button
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm transition-colors shadow-lg"
              onClick={onAddMedia}
              disabled={busy}
            >
              ➕ Add Media
            </button>

            <button
              className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 active:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm transition-colors shadow-lg"
              onClick={onAddYoutubeBatch}
              disabled={busy}
            >
              📺 Add Latest Videos from YouTube Channel-s
            </button>

            <button
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm transition-colors shadow-lg"
              onClick={onAddYoutubeSingle}
              disabled={busy}
            >
              ▶️ Add a Video from YouTube
            </button>

            <button
              onClick={onScanRegister}
              className="px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 font-bold text-sm transition-colors shadow-lg flex items-center gap-2"
              disabled={busy}
            >
              🔍 Scan & Register from S3
            </button>

            <button
              onClick={onMaintain}
              disabled={busy}
              className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 font-bold text-sm transition-colors shadow-lg"
            >
              ⚙️ Maintain Sections-Groups
            </button>
          </>
        )}
      </div>
    </header>
  );
}
