// app/admin/hooks/useSignedUrls.ts
"use client";

import { useCallback, useState } from "react";
import type { MediaItem } from "../types";
import { apiJson } from "../utils/apiJson";
import { s3KeyFromPublicUrl } from "../utils";

export function useSignedUrls(token: string, pushLog: (line: string) => void) {
  const [signedUrlByPk, setSignedUrlByPk] = useState<Record<string, string>>({});
  const [signBusyByPk, setSignBusyByPk] = useState<Record<string, boolean>>({});

  const resetSigned = useCallback(() => {
    setSignedUrlByPk({});
    setSignBusyByPk({});
  }, []);

  const ensureSignedUrl = useCallback(
    async (it: MediaItem) => {
      if (!it?.PK || !it?.url) return;

      // If it's already a full https URL, we can still presign if it's private,
      // BUT your new YouTube items are already valid public S3 URLs, so we don't need presign.
      // Only presign when we can extract an S3 key AND we actually need it.
      const key = s3KeyFromPublicUrl(it.url);
      if (!key) return;

      if (signedUrlByPk[it.PK]) return;
      if (signBusyByPk[it.PK]) return;

      setSignBusyByPk((prev) => ({ ...prev, [it.PK]: true }));

      try {
        const out = await apiJson(`/api/admin/presign-get?key=${encodeURIComponent(key)}`, {
          method: "GET",
          cache: "no-store",
          headers: {
            "x-admin-token": token || "",
          },
        });

        if (!out.ok || !out.data?.ok || !out.data?.url) {
          pushLog(`⚠️ presign-get failed for ${it.PK} (HTTP ${out.status})`);
          return;
        }

        const signed = String(out.data.url);
        setSignedUrlByPk((prev) => ({ ...prev, [it.PK]: signed }));
      } catch (e: any) {
        pushLog(`⚠️ presign-get error for ${it.PK}: ${e?.message ?? String(e)}`);
      } finally {
        setSignBusyByPk((prev) => ({ ...prev, [it.PK]: false }));
      }
    },
    [token, pushLog, signedUrlByPk, signBusyByPk]
  );

  const renderableUrl = useCallback(
    (it: MediaItem) => {
      if (!it?.PK) return it?.url || "";
      // prefer signed if present
      return signedUrlByPk[it.PK] || it.url;
    },
    [signedUrlByPk]
  );

  return { signedUrlByPk, signBusyByPk, ensureSignedUrl, renderableUrl, resetSigned };
}