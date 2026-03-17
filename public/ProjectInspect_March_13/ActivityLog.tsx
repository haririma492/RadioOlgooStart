// app/admin/components/ActivityLog.tsx
"use client";
import React from "react";

export function ActivityLog({
  logRef,
  log,
  setLog,
  busy,
  logCollapsed,
  setLogCollapsed,
}: {
  logRef: React.RefObject<HTMLPreElement>;
  log: string[];
  setLog: (v: string[]) => void;
  busy: boolean;
  logCollapsed: boolean;
  setLogCollapsed: (v: boolean) => void;
}) {
  return (
    <section className="bg-white/90 backdrop-blur-sm rounded-xl border border-slate-200 shadow-md p-4 mb-4">
      <div className="flex justify-between items-center">
        <button
          onClick={() => setLogCollapsed(!logCollapsed)}
          className="flex items-center gap-2 text-sm font-black text-slate-900 hover:text-slate-700"
        >
          <span>{logCollapsed ? "▶" : "▼"}</span>
          <span>Activity Log</span>
          {log.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
              {log.length}
            </span>
          )}
        </button>
        {!logCollapsed && (
          <button
            className="px-3 py-1 rounded-lg border border-slate-300 bg-transparent hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-xs transition-colors"
            onClick={() => setLog([])}
            disabled={busy}
          >
            Clear
          </button>
        )}
      </div>
      {!logCollapsed && (
        <pre
          ref={logRef}
          className="mt-3 bg-slate-900 text-green-300 p-3 rounded-lg overflow-auto max-h-[200px] text-xs font-mono leading-relaxed"
        >
          {log.length > 0 ? log.join("\n") : "No log entries yet..."}
        </pre>
      )}
    </section>
  );
}
