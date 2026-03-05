// app/admin/hooks/useAdminItems.ts
"use client";
import { useCallback, useState } from "react";
import { ItemsGetResponse, MediaItem } from "../types";
import { useApiJson } from "./useApiJson";

export function useAdminItems(token: string, pushLog: (s: string) => void) {
  const { apiJson } = useApiJson();
  const [busy, setBusy] = useState(false);
  const [allItems, setAllItems] = useState<MediaItem[]>([]);

  const refreshAll = useCallback(async () => {
    const t = token.trim();
    if (!t) return;
    setBusy(true);
    try {
      const out = await apiJson("/api/admin/slides", {
        method: "GET",
        headers: { "x-admin-token": t },
        cache: "no-store",
      });
      if (!out.ok) throw new Error(`Load failed (HTTP ${out.status})`);
      const data = out.data as ItemsGetResponse;
      if ((data as any).error) throw new Error((data as any).error);
      const loaded = (data as any).items || [];
      setAllItems(loaded);
      pushLog(`Loaded: ${loaded.length} total items`);
    } catch (e: any) {
      pushLog(`❌ ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }, [apiJson, token, pushLog]);

  return { busy, setBusy, allItems, setAllItems, refreshAll };
}
