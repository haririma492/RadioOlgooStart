// app/admin/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

type SetKind = "CENTER" | "BG";

type SlideItem = {
  pk: SetKind;
  sk: string;
  url: string;
  enabled?: boolean;
  order?: number;
  createdAt?: string;

  // New fields you asked for (optional)
  mediaType?: string; // e.g. "video/mp4" or "image/jpeg"
  category1?: string;
  category2?: string;
  description?: string;
};

type SlidesResp = {
  ok: boolean;
  set: SetKind;
  items: SlideItem[];
};

type PresignResp = {
  ok: boolean;
  uploadUrl: string; // PUT to this
  publicUrl: string; // store this in DynamoDB + use in UI
  key?: string;
};

const isVideoUrl = (url: string) => /\.mp4(\?|#|$)/i.test(url) || url.toLowerCase().includes("video");
const isImageUrl = (url: string) => /\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(url) || url.toLowerCase().includes("image");

function nowTime() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authMsg, setAuthMsg] = useState("");
  const [busy, setBusy] = useState(false);

  // Upload form
  const [uploadSet, setUploadSet] = useState<SetKind>("CENTER");
  const [files, setFiles] = useState<FileList | null>(null);
  const [category1, setCategory1] = useState("");
  const [category2, setCategory2] = useState("");
  const [description, setDescription] = useState("");

  // Lists
  const [centerItems, setCenterItems] = useState<SlideItem[]>([]);
  const [bgItems, setBgItems] = useState<SlideItem[]>([]);
  const [viewSet, setViewSet] = useState<SetKind>("CENTER");

  // Log
  const [logs, setLogs] = useState<string[]>([]);
  const addLog = (line: string) => setLogs((x) => [`${nowTime()}  ${line}`, ...x].slice(0, 250));

  const s3BaseOk = useMemo(() => {
    // purely UI display; upload uses presigned URL anyway
    return true;
  }, []);

  const headers = useMemo(() => {
    return {
      "x-admin-token": token.trim(),
    };
  }, [token]);

  async function loadSet(set: SetKind, t: string) {
    const res = await fetch(`/api/admin/slides?set=${encodeURIComponent(set)}`, {
      method: "GET",
      headers: { "x-admin-token": t.trim() },
      cache: "no-store",
    });
    if (!res.ok) {
      const txt = await safeText(res);
      throw new Error(`HTTP ${res.status} ${txt || ""}`.trim());
    }
    const data = (await res.json()) as SlidesResp | SlideItem[];
    const items = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [];
    // Normalize + sort
    return items
      .map((it) => ({
        pk: it.pk as SetKind,
        sk: String(it.sk),
        url: String(it.url),
        enabled: it.enabled ?? true,
        order: Number(it.order ?? 0),
        createdAt: it.createdAt,
        mediaType: it.mediaType,
        category1: it.category1,
        category2: it.category2,
        description: it.description,
      }))
      .filter((it) => !!it.url && it.enabled !== false)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.sk).localeCompare(String(b.sk)));
  }

  async function loadAll(t = token) {
    const [c, b] = await Promise.all([loadSet("CENTER", t), loadSet("BG", t)]);
    setCenterItems(c);
    setBgItems(b);
    addLog(`Loaded: CENTER=${c.length}, BG=${b.length}`);
  }

  async function verifyToken() {
    setAuthMsg("");
    const t = token.trim();
    if (!t) {
      setAuthMsg("❌ Please enter your admin token.");
      return;
    }
    setBusy(true);
    try {
      // Any protected endpoint works (this requires token)
      await loadSet("CENTER", t);
      setAuthed(true);
      setAuthMsg("");
      addLog("✅ Token accepted");
      await loadAll(t);
    } catch (e: any) {
      setAuthed(false);
      setAuthMsg("❌ Invalid admin token (or API error).");
      addLog(`Auth failed: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    setAuthed(false);
    setAuthMsg("");
    setFiles(null);
    addLog("Logged out");
  }

  async function presignOne(file: File, set: SetKind) {
    // Your presign route should exist: /api/admin/presign
    // Expected to return { ok, uploadUrl, publicUrl }
    const qs = new URLSearchParams({
      set,
      filename: file.name,
      contentType: file.type || "application/octet-stream",
    });
    const res = await fetch(`/api/admin/presign?${qs.toString()}`, {
      method: "GET",
      headers,
      cache: "no-store",
    });
    if (!res.ok) {
      const txt = await safeText(res);
      throw new Error(`Presign failed (HTTP ${res.status}) ${txt || ""}`.trim());
    }
    const data = (await res.json()) as PresignResp;
    if (!data?.uploadUrl || !data?.publicUrl) throw new Error("Presign response missing uploadUrl/publicUrl");
    return data;
  }

  async function registerInDdb(set: SetKind, publicUrl: string, file: File) {
    const body: any = {
      set,
      url: publicUrl,
      mediaType: file.type || (set === "CENTER" ? "video/mp4" : "image/jpeg"),
      category1: category1.trim() || undefined,
      category2: category2.trim() || undefined,
      description: description.trim() || undefined,
    };

    const res = await fetch(`/api/admin/slides`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await safeText(res);
      throw new Error(`DDB register failed (HTTP ${res.status}) ${txt || ""}`.trim());
    }
    return res.json();
  }

  function validateFilesForSet(set: SetKind, list: FileList) {
    const arr = Array.from(list);
    if (set === "CENTER") {
      // videos only
      const bad = arr.find((f) => !f.type || !f.type.toLowerCase().includes("video"));
      if (bad) throw new Error(`CENTER must be videos. "${bad.name}" looks like "${bad.type || "unknown"}"`);
    } else {
      // BG images only
      const bad = arr.find((f) => !f.type || !f.type.toLowerCase().includes("image"));
      if (bad) throw new Error(`BG must be images. "${bad.name}" looks like "${bad.type || "unknown"}"`);
    }
  }

  async function uploadAll() {
    if (!authed) return setAuthMsg("❌ Verify token first.");
    if (!files || files.length === 0) return addLog("No files selected.");

    setBusy(true);
    try {
      validateFilesForSet(uploadSet, files);

      const list = Array.from(files);
      addLog(`Uploading ${list.length} file(s) to ${uploadSet}...`);

      for (const f of list) {
        // 1) Presign
        const { uploadUrl, publicUrl } = await presignOne(f, uploadSet);

        // 2) PUT file to S3
        const put = await fetch(uploadUrl, {
          method: "PUT",
          body: f,
          headers: {
            "content-type": f.type || "application/octet-stream",
          },
        });

        if (!put.ok) {
          const txt = await safeText(put);
          throw new Error(`S3 PUT failed for "${f.name}" (HTTP ${put.status}) ${txt || ""}`.trim());
        }

        // 3) Register in DynamoDB
        await registerInDdb(uploadSet, publicUrl, f);
        addLog(`✅ Uploaded: ${f.name} → ${uploadSet}`);
      }

      // reload lists
      await loadAll();
      setFiles(null);
      // keep metadata fields (category/desc) so you can upload multiple with same tags if you want
    } catch (e: any) {
      addLog(`❌ Upload failed: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function deleteOne(set: SetKind, sk: string) {
    if (!authed) return;
    if (!confirm(`Delete this item?\n\n${set} / ${sk}`)) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/slides?set=${encodeURIComponent(set)}&sk=${encodeURIComponent(sk)}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) {
        const txt = await safeText(res);
        throw new Error(`Delete failed (HTTP ${res.status}) ${txt || ""}`.trim());
      }
      addLog(`🗑️ Deleted: ${set} / ${sk}`);
      await loadAll();
    } catch (e: any) {
      addLog(`❌ Delete error: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const items = viewSet === "CENTER" ? centerItems : bgItems;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.hTitle}>📻 Radio Olgoo Admin</div>
          <div style={styles.hSub}>Upload, list, and delete media for <b>CENTER</b> (videos) + <b>BG</b> (images).</div>
        </div>
        <div style={styles.badge(authed ? "ok" : "locked")}>{authed ? "AUTHORIZED" : "LOCKED"}</div>
      </div>

      {/* AUTH */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Admin token</div>
        <div style={styles.row}>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste ADMIN_TOKEN here"
            style={styles.input}
            disabled={busy}
          />
          <button onClick={verifyToken} style={styles.btnPrimary} disabled={busy}>
            {authed ? "Re-Verify" : "Enter Dashboard"}
          </button>
          <button onClick={logout} style={styles.btn} disabled={busy}>
            Log out
          </button>
          <button
            onClick={() => authed && loadAll()}
            style={styles.btn}
            disabled={busy || !authed}
            title="Reload lists"
          >
            Refresh
          </button>
        </div>
        {authMsg ? <div style={styles.authMsg}>{authMsg}</div> : null}
        <div style={styles.hint}>Tip: if you edit <code>.env.local</code>, restart <code>npm run dev</code>.</div>
      </div>

      <div style={styles.grid2}>
        {/* UPLOAD */}
        <div style={styles.card}>
          <div style={styles.cardTopRow}>
            <div style={styles.cardTitle}>⬆️ Upload media</div>
            <div style={styles.miniTag}>{s3BaseOk ? "S3 base OK" : "S3 base missing"}</div>
          </div>

          <label style={styles.label}>Target set</label>
          <select value={uploadSet} onChange={(e) => setUploadSet(e.target.value as SetKind)} style={styles.select} disabled={busy || !authed}>
            <option value="CENTER">CENTER (videos)</option>
            <option value="BG">BG (images)</option>
          </select>

          <label style={styles.label}>Choose files</label>
          <input
            type="file"
            multiple
            onChange={(e) => setFiles(e.target.files)}
            style={styles.file}
            disabled={busy || !authed}
            accept={uploadSet === "CENTER" ? "video/mp4,video/*" : "image/*"}
          />

          <div style={styles.metaGrid}>
            <div>
              <label style={styles.labelSmall}>Category 1</label>
              <input
                value={category1}
                onChange={(e) => setCategory1(e.target.value)}
                style={styles.inputSmall}
                placeholder="optional"
                disabled={busy || !authed}
              />
            </div>
            <div>
              <label style={styles.labelSmall}>Category 2</label>
              <input
                value={category2}
                onChange={(e) => setCategory2(e.target.value)}
                style={styles.inputSmall}
                placeholder="optional"
                disabled={busy || !authed}
              />
            </div>
          </div>

          <label style={styles.labelSmall}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={styles.textarea}
            placeholder="optional"
            disabled={busy || !authed}
          />

          <button onClick={uploadAll} style={styles.btnPrimaryWide} disabled={busy || !authed}>
            Upload to S3 + Register
          </button>

          <div style={styles.hint}>
            CENTER accepts <b>.mp4</b>. BG accepts <b>images</b>. Upload uses presigned S3 PUT (your AWS creds stay server-side).
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={styles.cardTitle}>Log</div>
            <div style={styles.logBox}>
              {logs.length ? logs.map((l, i) => <div key={i} style={styles.logLine}>{l}</div>) : <div style={styles.logLine}>No actions yet.</div>}
            </div>
            <button onClick={() => setLogs([])} style={styles.btnSmall} disabled={busy}>
              Clear
            </button>
          </div>
        </div>

        {/* LISTS */}
        <div style={styles.card}>
          <div style={styles.cardTopRow}>
            <div style={styles.cardTitle}>🗂️ Items</div>
            <div style={styles.rightControls}>
              <select value={viewSet} onChange={(e) => setViewSet(e.target.value as SetKind)} style={styles.selectSmall} disabled={busy || !authed}>
                <option value="CENTER">CENTER</option>
                <option value="BG">BG</option>
              </select>
              <button onClick={() => authed && loadAll()} style={styles.btn} disabled={busy || !authed}>
                Refresh
              </button>
            </div>
          </div>

          <div style={styles.stats}>
            Showing <b>{viewSet}</b> — {items.length} item(s)
          </div>

          <div style={styles.cardsGrid}>
            {!items.length ? (
              <div style={styles.empty}>No items yet.</div>
            ) : (
              items.map((it) => (
                <div key={it.sk} style={styles.itemCard}>
                  <div style={styles.thumb}>
                    {isVideoUrl(it.url) || it.mediaType?.includes("video") ? (
                      <video
                        src={it.url}
                        style={styles.media}
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <img
                        src={it.url}
                        alt={it.sk}
                        style={styles.media}
                      />
                    )}
                  </div>

                  <div style={styles.itemMeta}>
                    <div style={styles.sk}>{it.sk}</div>
                    <div style={styles.smallMuted}>
                      {it.mediaType ? <span>{it.mediaType}</span> : null}
                      {it.category1 ? <span> • {it.category1}</span> : null}
                      {it.category2 ? <span> • {it.category2}</span> : null}
                    </div>
                    {it.description ? <div style={styles.desc}>{it.description}</div> : null}
                  </div>

                  <div style={styles.itemBtns}>
                    <button onClick={() => window.open(it.url, "_blank", "noopener,noreferrer")} style={styles.btn}>
                      Open
                    </button>
                    <button onClick={() => deleteOne(it.pk, it.sk)} style={styles.btnDanger} disabled={busy}>
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={styles.hint}>
            If thumbnails don’t show: for videos we preview with <code>&lt;video&gt;</code> (muted). For images we use <code>&lt;img&gt;</code>.
          </div>
        </div>
      </div>
    </div>
  );
}

async function safeText(res: Response) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

const styles: Record<string, any> = {
  page: {
    minHeight: "100vh",
    padding: 18,
    background: "#f6f7fb",
    color: "#111",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  hTitle: { fontSize: 30, fontWeight: 900, letterSpacing: 0.2 },
  hSub: { marginTop: 4, opacity: 0.8, fontWeight: 600 },

  badge: (kind: "ok" | "locked") => ({
    padding: "8px 12px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 12,
    letterSpacing: 0.6,
    border: "1px solid " + (kind === "ok" ? "rgba(0,160,70,0.35)" : "rgba(200,0,0,0.25)"),
    background: kind === "ok" ? "rgba(0,160,70,0.12)" : "rgba(200,0,0,0.08)",
    color: kind === "ok" ? "#086a34" : "#8b0000",
  }),

  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" },

  card: {
    background: "#fff",
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.08)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
    padding: 16,
  },

  cardTopRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: 900, marginBottom: 8 },
  miniTag: {
    fontSize: 12,
    fontWeight: 800,
    opacity: 0.8,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(0,0,0,0.03)",
  },

  row: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },

  input: {
    flex: 1,
    minWidth: 240,
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.18)",
    outline: "none",
    fontSize: 14,
  },

  inputSmall: {
    width: "100%",
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.18)",
    outline: "none",
    fontSize: 13,
  },

  textarea: {
    width: "100%",
    minHeight: 70,
    resize: "vertical" as const,
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.18)",
    outline: "none",
    fontSize: 13,
  },

  btnPrimary: {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.20)",
    background: "#111",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },
  btnPrimaryWide: {
    width: "100%",
    marginTop: 10,
    padding: "14px 14px",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.20)",
    background: "#111",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 15,
  },
  btn: {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "#fff",
    color: "#111",
    fontWeight: 800,
    cursor: "pointer",
  },
  btnSmall: {
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "#fff",
    color: "#111",
    fontWeight: 800,
    cursor: "pointer",
  },
  btnDanger: {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(180,0,32,0.35)",
    background: "rgba(180,0,32,0.10)",
    color: "#8b001a",
    fontWeight: 900,
    cursor: "pointer",
  },

  authMsg: { marginTop: 10, fontWeight: 900, color: "#b00020" },
  hint: { marginTop: 8, opacity: 0.75, fontWeight: 600, fontSize: 12 },

  label: { display: "block", marginTop: 10, marginBottom: 6, fontWeight: 900 },
  labelSmall: { display: "block", marginTop: 10, marginBottom: 6, fontWeight: 900, fontSize: 12, opacity: 0.85 },
  select: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.18)",
    fontWeight: 800,
    background: "#fff",
  },
  selectSmall: {
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.18)",
    fontWeight: 800,
    background: "#fff",
  },
  file: { width: "100%", marginTop: 4 },

  metaGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 6 },

  rightControls: { display: "flex", gap: 10, alignItems: "center" },
  stats: { opacity: 0.75, fontWeight: 700, fontSize: 13, marginBottom: 10 },

  cardsGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 },
  empty: { padding: 14, borderRadius: 12, border: "1px dashed rgba(0,0,0,0.18)", opacity: 0.7, fontWeight: 800 },

  itemCard: {
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,0.08)",
    overflow: "hidden",
    background: "#fff",
  },
  thumb: { width: "100%", height: 160, background: "rgba(0,0,0,0.04)" },
  media: { width: "100%", height: "100%", objectFit: "cover" as const, display: "block" },

  itemMeta: { padding: 10 },
  sk: { fontWeight: 900, fontSize: 12, wordBreak: "break-all" as const },
  smallMuted: { marginTop: 4, fontSize: 12, opacity: 0.7, fontWeight: 700 },
  desc: { marginTop: 6, fontSize: 12, opacity: 0.9, fontWeight: 700 },

  itemBtns: { display: "flex", gap: 10, padding: 10 },

  logBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(0,0,0,0.03)",
    maxHeight: 240,
    overflow: "auto",
  },
  logLine: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12, whiteSpace: "pre-wrap" as const },
};
