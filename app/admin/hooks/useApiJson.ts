// app/admin/hooks/useApiJson.ts
"use client";
import { useCallback } from "react";

export function useApiJson() {
  const apiJson = useCallback(async (url: string, init?: RequestInit) => {
    const res = await fetch(url, init);
    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {}
    return { ok: res.ok, status: res.status, text, data, headers: res.headers };
  }, []);

  return { apiJson };
}
