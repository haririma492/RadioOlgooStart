// app/admin/components/YouTubeProgressPanel.tsx
"use client";
import React from "react";

export type YoutubeProgressState = {
  current: number;
  total: number;
  currentVideo: string;
  status: string;
  details: Array<{
    title: string;
    status: "fetching" | "downloading" | "uploading" | "saving" | "done" | "error";
    uploadDate?: string;
    size?: string;
    s3Url?: string;
    error?: string;
  }>;
};

export function YouTubeProgressPanel({
  youtubeProgress,
  onDoneRefresh,
  onImportMore,
}: {
  youtubeProgress: YoutubeProgressState;
  onDoneRefresh: () => void;
  onImportMore: () => void;
}) {
  const pct = youtubeProgress.total ? (youtubeProgress.current / youtubeProgress.total) * 100 : 0;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-black text-slate-900">🚀 Downloading & Uploading Videos</h2>
        <div className="text-sm font-bold text-slate-600">
          {youtubeProgress.current} / {youtubeProgress.total} Complete
        </div>
      </div>

      <div className="w-full bg-slate-200 rounded-full h-3 mb-6">
        <div className="bg-green-600 h-3 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>

      {youtubeProgress.status && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm font-bold text-blue-900">{youtubeProgress.status}</p>
        </div>
      )}

      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {(youtubeProgress.details || []).map((video, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-lg border-2 ${
              video.status === "done"
                ? "bg-green-50 border-green-300"
                : video.status === "error"
                ? "bg-red-50 border-red-300"
                : video.status === "downloading" || video.status === "uploading" || video.status === "saving"
                ? "bg-blue-50 border-blue-300"
                : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-bold text-slate-900 mb-2">
                  {idx + 1}. {video.title}
                </h3>
                {video.uploadDate && <p className="text-xs text-slate-600 mb-1">📅 Uploaded: {video.uploadDate}</p>}
                <div className="flex items-center gap-2">
                  {video.status === "fetching" && <span className="text-sm text-slate-600">⏳ Waiting...</span>}
                  {video.status === "downloading" && (
                    <span className="text-sm text-blue-600 font-bold">⬇️ Downloading from YouTube...</span>
                  )}
                  {video.status === "uploading" && (
                    <span className="text-sm text-blue-600 font-bold">⬆️ Uploading to S3...</span>
                  )}
                  {video.status === "saving" && (
                    <span className="text-sm text-blue-600 font-bold">💾 Saving to DynamoDB...</span>
                  )}
                  {video.status === "done" && (
                    <>
                      <span className="text-sm text-green-600 font-bold">✅ Complete!</span>
                      {video.size && <span className="text-xs text-slate-600">({video.size})</span>}
                    </>
                  )}
                  {video.status === "error" && <span className="text-sm text-red-600 font-bold">❌ Failed</span>}
                </div>
                {video.s3Url && (
                  <a href={video.s3Url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                    🔗 View in S3
                  </a>
                )}
                {video.error && <p className="text-xs text-red-600 mt-1">Error: {video.error}</p>}
              </div>
              <div className="ml-4">
                {video.status === "done" && <div className="text-2xl">✅</div>}
                {video.status === "error" && <div className="text-2xl">❌</div>}
                {(video.status === "downloading" || video.status === "uploading" || video.status === "saving") && (
                  <div className="text-2xl animate-spin">⏳</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {youtubeProgress.current === youtubeProgress.total && (
        <div className="mt-6 flex gap-3">
          <button
            onClick={onDoneRefresh}
            className="flex-1 px-4 py-3 rounded-lg bg-green-600 text-white hover:bg-green-700 font-bold text-sm transition-colors"
          >
            ✅ Done! Refresh Page
          </button>
          <button
            onClick={onImportMore}
            className="px-4 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-bold text-sm transition-colors"
          >
            ➕ Import More Videos
          </button>
        </div>
      )}
    </div>
  );
}
