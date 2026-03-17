// app/admin/components/ItemCard.tsx
"use client";
import React from "react";
import { MediaItem } from "./types";
import { isImage, isVideo } from "./utils";

export function ItemCard({
  it,
  src,
  isEditing,
  usingSigned,
  signBusy,
  busy,
  onHoverNeedSigned,
  onStartEdit,
  onDelete,
  onGetSigned,
  onOpen,
  renderEditingArea,
}: {
  it: MediaItem;
  src: string;
  isEditing: boolean;
  usingSigned: boolean;
  signBusy: boolean;
  busy: boolean;
  onHoverNeedSigned: () => void;
  onStartEdit: () => void;
  onDelete: () => void;
  onGetSigned: () => void;
  onOpen: () => void;
  renderEditingArea: () => React.ReactNode;
}) {
  return (
    <div
      className={`group border border-slate-200 rounded-lg bg-white shadow-sm hover:shadow-lg transition-all overflow-hidden ${
        isEditing ? "md:col-span-2 lg:col-span-3" : ""
      }`}
      onMouseEnter={onHoverNeedSigned}
    >
      <div className="relative aspect-video bg-slate-100 overflow-hidden">
        {isVideo(it.url) ? (
          <video src={src} className="w-full h-full object-cover" preload="metadata" muted />
        ) : isImage(it.url) ? (
          <img src={src} alt={it.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-200">
            <span className="text-slate-400 text-2xl">📄</span>
          </div>
        )}

        {(isVideo(it.url) || isImage(it.url)) && (
          <div className="absolute left-2 top-2">
            {signBusy ? (
              <span className="px-2 py-1 rounded bg-slate-900/80 text-white text-[11px] font-black">⏳ signing</span>
            ) : usingSigned ? (
              <span className="px-2 py-1 rounded bg-emerald-600/90 text-white text-[11px] font-black">🔓 signed</span>
            ) : (
              <span className="px-2 py-1 rounded bg-slate-700/70 text-white text-[11px] font-black">link</span>
            )}
          </div>
        )}

        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isEditing ? (
            <>
              <button
                className="p-1.5 rounded bg-blue-500 text-white hover:bg-blue-600 shadow-lg"
                onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
                disabled={busy}
                title="Edit"
              >
                ✏️
              </button>
              <button
                className="p-1.5 rounded bg-red-500 text-white hover:bg-red-600 shadow-lg"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                disabled={busy}
                title="Delete"
              >
                🗑️
              </button>
            </>
          ) : null}
        </div>
      </div>

      {!isEditing ? (
        <div className="p-3">
          <div className="text-xs text-slate-500 font-bold mb-1 truncate">{it.PK}</div>
          <h3 className="text-sm font-black text-slate-900 mb-2 line-clamp-2 min-h-[2.5rem]">{it.title}</h3>
          <div className="space-y-1 text-xs text-slate-600">
            {it.section && (
              <div className="truncate">
                <span className="font-semibold">Section:</span> {it.section}
              </div>
            )}
            {it.group && (
              <div className="truncate">
                <span className="font-semibold">Group:</span> {it.group}
              </div>
            )}
            {it.person && (
              <div className="truncate">
                <span className="font-semibold">Person:</span> {it.person}
              </div>
            )}
          </div>
          <div className="mt-2 flex items-center gap-3">
            <button
              className="inline-block text-xs text-blue-600 hover:text-blue-700 font-semibold"
              onClick={(e) => { e.stopPropagation(); onOpen(); }}
            >
              🔗 Open
            </button>
            {(isVideo(it.url) || isImage(it.url)) && (
              <button
                className="text-xs font-bold text-slate-700 hover:text-slate-900"
                onClick={(e) => { e.stopPropagation(); onGetSigned(); }}
                disabled={signBusy}
                title="Get signed URL"
              >
                {signBusy ? "⏳ Signing..." : "🔓 Get signed"}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          {renderEditingArea()}
        </div>
      )}
    </div>
  );
}
