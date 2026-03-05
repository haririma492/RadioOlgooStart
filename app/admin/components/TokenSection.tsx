// app/admin/components/TokenSection.tsx
"use client";
import React from "react";

export function TokenSection({
  token,
  setToken,
  verifyToken,
  logout,
  authError,
  busy,
}: {
  token: string;
  setToken: (v: string) => void;
  verifyToken: () => void;
  logout: () => void;
  authError: string;
  busy: boolean;
}) {
  return (
    <section className="bg-white/95 backdrop-blur-sm rounded-xl border border-slate-200 shadow-lg p-4 mb-4 max-w-2xl mx-auto">
      <div className="mb-3">
        <h2 className="text-base font-black text-slate-900 mb-1">Admin Token</h2>
        <p className="text-xs text-slate-600">Enter the admin token to unlock this screen.</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="password"
          placeholder="ADMIN_TOKEN"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && verifyToken()}
          className="flex-1 px-4 py-3 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm font-medium placeholder:text-slate-400"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          className="px-6 py-3 rounded-xl bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm transition-colors shadow-lg"
          onClick={verifyToken}
          disabled={busy}
        >
          Verify
        </button>
        <button
          className="px-6 py-3 rounded-xl border border-slate-300 bg-transparent hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm transition-colors"
          onClick={logout}
          disabled={busy}
        >
          Log out
        </button>
      </div>
      {authError && (
        <div className="mt-4 px-4 py-3 rounded-xl border border-red-300 bg-red-50 text-red-700 font-bold text-sm">
          ⚠️ {authError}
        </div>
      )}
    </section>
  );
}
