// app/admin/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type TargetSet = "CENTER" | "SLIDES" | "BG";

type MediaItem = {
  pk: TargetSet;
  sk: string;
  url: string;
  mediaType?: string; // "video/mp4" | "image/jpeg" etc
  enabled: boolean;
  order: number;
  category1?: string;
  category2?: string;
  description?: string;
  createdAt?: string;
};

type SlidesGetResponse =
  | { ok: true; set: TargetSet; items: MediaItem[]; count?: number }
  | { error: string; detail?: string };

function nowTime() {
  return new Date().toLocaleTimeString([], { hour12: true });
}

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [authorized, setAuthorized] = useState(false);

  // IMPORTANT: Separate "upload target" from "library view tab"
  const [uploadTarget, setUploadTarget] = useState<TargetSet>("CENTER");
  const [viewTarget, setViewTarget] = useState<TargetSet>("CENTER");

  // optional metadata (stored in DynamoDB)
  const [category1, setCategory1] = useState("");
  const [category2, setCategory2] = useState("");
  const [description, setDescription] = useState("");

  // selected files
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // lists
  const [centerItems, setCenterItems] = useState<MediaItem[]>([]);
  const [slidesItems, setSlidesItems] = useState<MediaItem[]>([]);
  const [bgItems, setBgItems] = useState<MediaItem[]>([]);

  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const accepts = useMemo(() => {
    if (uploadTarget === "CENTER") return "video/mp4";
    if (uploadTarget === "SLIDES") return "image/*";
    return "image/*,video/mp4"; // BG
  }, [uploadTarget]);

  function pushLog(line: string) {
    setLog((prev) => [`${nowTime()}  ${line}`, ...prev].slice(0, 400));
  }

  async function apiJson(url: string, init?: RequestInit) {
    const res = await fetch(url, init);
    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      // keep null
    }
    return { ok: res.ok, status: res.status, text, data };
  }

  function clearFiles() {
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function guessContentType(file: File) {
    // Some Windows/OneDrive selections can come with empty file.type.
    if (file.type) return file.type;

    const name = file.name.toLowerCase();
    if (name.endsWith(".mp4")) return "video/mp4";
    if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
    if (name.endsWith(".png")) return "image/png";
    if (name.endsWith(".webp")) return "image/webp";
    if (name.endsWith(".gif")) return "image/gif";
    return "application/octet-stream";
  }

  function isImage(file: File) {
    const ct = guessContentType(file).toLowerCase();
    const name = file.name.toLowerCase();
    return ct.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)$/.test(name);
  }

  function isMp4(file: File) {
    const ct = guessContentType(file).toLowerCase();
    const name = file.name.toLowerCase();
    return ct === "video/mp4" || name.endsWith(".mp4");
  }

  async function verifyToken() {
    const t = token.trim();
    if (!t) {
      setAuthorized(false);
      pushLog("❌ Missing token");
      return;
    }

    const out = await apiJson("/api/admin/validate", {
      method: "POST",
      headers: { "x-admin-token": t },
    });

    if (!out.ok) {
      setAuthorized(false);
      pushLog(`❌ Invalid admin token (HTTP ${out.status})`);
      return;
    }

    setAuthorized(true);
    pushLog("✅ Token accepted");
    // NOTE: refresh happens via useEffect below (authorized -> true)
  }

  async function loadSet(set: TargetSet, t: string) {
    const out = await apiJson(`/api/admin/slides?set=${encodeURIComponent(set)}`, {
      method: "GET",
      headers: { "x-admin-token": t },
      cache: "no-store",
    });

    if (!out.ok) {
      const msg = out.data?.detail || out.data?.error || out.text || "Load failed";
      throw new Error(`Load failed for ${set} (HTTP ${out.status}) ${msg}`);
    }

    const data = out.data as SlidesGetResponse;
    if (!data || (data as any).error) {
      throw new Error(`Load failed for ${set} (HTTP ${out.status}) ${out.text}`);
    }

    const items = (data as any).items as MediaItem[];
    return Array.isArray(items) ? items : [];
  }

  async function refreshAll() {
    const t = token.trim();

    // IMPORTANT FIX:
    // Don't gate on `authorized` here (it can be stale right after setAuthorized(true)).
    // Gate on the actual token presence instead.
    if (!t) return;

    try {
      const [c, s, b] = await Promise.all([loadSet("CENTER", t), loadSet("SLIDES", t), loadSet("BG", t)]);
      setCenterItems(c);
      setSlidesItems(s);
      setBgItems(b);
      pushLog(`Loaded: CENTER=${c.length}, SLIDES=${s.length}, BG=${b.length}`);
    } catch (e: any) {
      pushLog(`❌ ${e?.message ?? String(e)}`);
    }
  }

  // Auto-refresh immediately after authorization flips to true
  useEffect(() => {
    if (!authorized) return;
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized]);

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files || []);
    setFiles(list);
    if (list.length) pushLog(`Selected ${list.length} file(s) for ${uploadTarget}`);
  }

  async function presignOne(set: TargetSet, file: File) {
    const t = token.trim();
    const contentType = encodeURIComponent(guessContentType(file));
    const filename = encodeURIComponent(file.name);

    const out = await apiJson(
      `/api/admin/presign?set=${encodeURIComponent(set)}&filename=${filename}&contentType=${contentType}`,
      {
        method: "GET",
        headers: { "x-admin-token": t },
        cache: "no-store",
      }
    );

    if (!out.ok) {
      const msg = out.data?.detail || out.data?.error || out.text || "Presign failed";
      throw new Error(`Presign failed for ${set} (HTTP ${out.status}) ${msg}`);
    }
    return out.data as { ok: true; uploadUrl: string; publicUrl: string; key: string };
  }

  async function registerOne(item: {
    set: TargetSet;
    url: string;
    mediaType: string;
    category1?: string;
    category2?: string;
    description?: string;
  }) {
    const t = token.trim();
    const out = await apiJson("/api/admin/slides", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-admin-token": t,
      },
      body: JSON.stringify(item),
    });

    if (!out.ok) {
      const msg = out.data?.detail || out.data?.error || out.text || "Register failed";
      throw new Error(`Register failed (HTTP ${out.status}) ${msg}`);
    }
  }

  function validateFilesForTarget(target: TargetSet, list: File[]) {
    if (!list.length) return { ok: false, message: "No files selected" };

    if (target === "CENTER") {
      const bad = list.find((f) => !isMp4(f));
      if (bad) return { ok: false, message: `CENTER accepts only .mp4. Bad: ${bad.name}` };
      return { ok: true as const };
    }

    if (target === "SLIDES") {
      const bad = list.find((f) => !isImage(f));
      if (bad) return { ok: false, message: `SLIDES accepts only images. Bad: ${bad.name}` };
      return { ok: true as const };
    }

    // BG
    const bad = list.find((f) => !(isImage(f) || isMp4(f)));
    if (bad) return { ok: false, message: `BG accepts image or .mp4. Bad: ${bad.name}` };
    return { ok: true as const };
  }

  async function uploadAll() {
    if (!authorized) {
      pushLog("❌ Not authorized");
      return;
    }

    const check = validateFilesForTarget(uploadTarget, files);
    if (!check.ok) {
      pushLog(`❌ ${check.message}`);
      return;
    }

    setBusy(true);
    try {
      pushLog(`Uploading ${files.length} file(s) to ${uploadTarget}...`);

      for (const f of files) {
        const pres = await presignOne(uploadTarget, f);
        const contentType = guessContentType(f);

        // PUT to S3
        const putRes = await fetch(pres.uploadUrl, {
          method: "PUT",
          headers: { "content-type": contentType },
          body: f,
        });
        if (!putRes.ok) {
          throw new Error(`S3 upload failed (HTTP ${putRes.status}) ${f.name}`);
        }

        // Register in DynamoDB
        await registerOne({
          set: uploadTarget,
          url: pres.publicUrl,
          mediaType: contentType,
          category1: category1.trim(),
          category2: category2.trim(),
          description: description.trim(),
        });

        pushLog(`✅ Uploaded: ${f.name} → ${uploadTarget}`);
      }

      clearFiles();
      await refreshAll();
    } catch (e: any) {
      pushLog(`❌ Upload failed: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function deleteItem(it: MediaItem) {
    if (!authorized) {
      pushLog("❌ Not authorized");
      return;
    }

    setBusy(true);
    try {
      const t = token.trim();
      const out = await apiJson(
        `/api/admin/slides?set=${encodeURIComponent(it.pk)}&sk=${encodeURIComponent(it.sk)}`,
        {
          method: "DELETE",
          headers: { "x-admin-token": t },
        }
      );
      if (!out.ok) {
        const msg = out.data?.detail || out.data?.error || out.text || "Delete failed";
        throw new Error(`Delete failed (HTTP ${out.status}) ${msg}`);
      }
      pushLog(`🗑️ Deleted: ${it.pk} / ${it.sk}`);
      await refreshAll();
    } catch (e: any) {
      pushLog(`❌ ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  function renderPreview(it: MediaItem) {
    const mt = (it.mediaType || "").toLowerCase();
    const isVideo = mt.startsWith("video/") || it.url.toLowerCase().endsWith(".mp4");
    if (isVideo) {
      return (
        <video
          src={it.url}
          controls
          preload="metadata"
          style={{
            width: "100%",
            height: 180,
            objectFit: "cover",
            borderRadius: 10,
            background: "#111",
          }}
        />
      );
    }
    return (
      <img
        src={it.url}
        alt={it.sk}
        style={{
          width: "100%",
          height: 180,
          objectFit: "cover",
          borderRadius: 10,
          background: "#111",
        }}
      />
    );
  }

  const listFor = (set: TargetSet) => {
    if (set === "CENTER") return centerItems;
    if (set === "SLIDES") return slidesItems;
    return bgItems;
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.h1}>Radio Olgoo Admin</div>
          <div style={styles.sub}>Upload, list, and delete media for CENTER + SLIDES + BG.</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ ...styles.badge, background: authorized ? "#1f8f4e" : "#a11" }}>
            {authorized ? "AUTHORIZED" : "NOT AUTHORIZED"}
          </span>
          <button style={styles.btn} onClick={refreshAll} disabled={!authorized || busy}>
            Refresh
          </button>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.cardTitle}>Admin token</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="password"
            placeholder="Paste ADMIN_TOKEN from .env.local (no quotes)"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            style={styles.input}
          />
          <button style={styles.btnPrimary} onClick={verifyToken} disabled={busy}>
            Verify
          </button>
          <button
            style={styles.btn}
            onClick={() => {
              setToken("");
              setAuthorized(false);
              clearFiles();
              setCenterItems([]);
              setSlidesItems([]);
              setBgItems([]);
              pushLog("Logged out");
            }}
            disabled={busy}
          >
            Log out
          </button>
        </div>
        <div style={styles.tip}>
          Tip: if you edit .env.local, restart <code>npm run dev</code>.
        </div>
      </div>

      <div style={styles.grid}>
        <div style={styles.card}>
          <div style={styles.cardTitle}>Upload media</div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ minWidth: 240 }}>
              <label style={styles.label}>Target</label>
              <select
                value={uploadTarget}
                onChange={(e) => setUploadTarget(e.target.value as TargetSet)}
                style={styles.select}
                disabled={busy}
              >
                <option value="CENTER">CENTER (video slideshow)</option>
                <option value="SLIDES">SLIDES (left slideshow)</option>
                <option value="BG">BG (wallpaper — ONLY ONE ACTIVE)</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            <div>
              <label style={styles.label}>Category 1</label>
              <input
                value={category1}
                onChange={(e) => setCategory1(e.target.value)}
                placeholder="e.g. Iran"
                style={styles.input}
                disabled={busy}
              />
            </div>
            <div>
              <label style={styles.label}>Category 2</label>
              <input
                value={category2}
                onChange={(e) => setCategory2(e.target.value)}
                placeholder="e.g. Toronto"
                style={styles.input}
                disabled={busy}
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={styles.label}>Description</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description"
                style={styles.input}
                disabled={busy}
              />
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={styles.label}>Choose file(s)</label>
            <div style={styles.fileRow}>
              <input
                ref={fileInputRef}
                type="file"
                multiple={uploadTarget !== "BG"} // BG typically 1 file
                accept={accepts}
                onChange={onPickFiles}
                disabled={busy}
              />
              <div style={styles.accepts}>Accepts: {accepts || "any"}</div>
              {!!files.length && (
                <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 800 }}>Selected: {files.length}</div>
              )}
            </div>
            <div style={styles.smallMuted}>
              CENTER accepts <b>.mp4</b>. SLIDES accepts <b>images</b>. BG accepts <b>image/video</b> and should
              keep only one active.
            </div>
          </div>

          <button style={styles.bigBtn} onClick={uploadAll} disabled={!authorized || busy}>
            {busy ? "Working..." : "Upload to S3 + Register"}
          </button>
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>Library</div>

          <div style={styles.tabs}>
            {(["CENTER", "SLIDES", "BG"] as TargetSet[]).map((set) => (
              <button
                key={set}
                style={{
                  ...styles.tab,
                  ...(set === viewTarget ? styles.tabActive : {}),
                }}
                onClick={() => setViewTarget(set)}
                disabled={busy}
              >
                {set} ({listFor(set).length})
              </button>
            ))}
          </div>

          <div style={styles.itemsGrid}>
            {listFor(viewTarget).map((it) => (
              <div key={it.sk} style={styles.itemCard}>
                {renderPreview(it)}
                <div style={styles.itemMeta}>
                  <div style={styles.itemSk}>{it.sk}</div>
                  <div style={styles.itemDesc}>
                    {[it.category1, it.category2].filter(Boolean).join(" · ")}
                    {it.description ? ` — ${it.description}` : ""}
                  </div>
                </div>
                <div style={styles.itemBtns}>
                  <a href={it.url} target="_blank" rel="noreferrer" style={styles.btn}>
                    Open
                  </a>
                  <button style={styles.btnDanger} onClick={() => deleteItem(it)} disabled={busy}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {!listFor(viewTarget).length ? <div style={styles.empty}>No items in {viewTarget}.</div> : null}
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.cardTitle}>Log</div>
        <button style={styles.btn} onClick={() => setLog([])} disabled={busy}>
          Clear
        </button>
        <pre style={styles.logBox}>{log.join("\n")}</pre>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: 18,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    background: "#f6f7fb",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    marginBottom: 14,
  },
  h1: { fontSize: 28, fontWeight: 900 },
  sub: { opacity: 0.7, marginTop: 2 },
  badge: {
    color: "white",
    padding: "6px 10px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(320px, 420px) 1fr",
    gap: 14,
    alignItems: "start",
  },
  card: {
    background: "white",
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,0.08)",
    boxShadow: "0 12px 30px rgba(0,0,0,0.05)",
    padding: 14,
    marginBottom: 14,
  },
  cardTitle: { fontWeight: 900, fontSize: 18, marginBottom: 10 },
  label: { display: "block", fontWeight: 800, marginBottom: 6, fontSize: 13 },
  input: {
    width: "min(720px, 100%)",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.18)",
    outline: "none",
  },
  select: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
    fontWeight: 800,
  },
  btn: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
    cursor: "pointer",
    fontWeight: 800,
    textDecoration: "none",
    color: "black",
    display: "inline-flex",
    justifyContent: "center",
    alignItems: "center",
  },
  btnPrimary: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "black",
    color: "white",
    cursor: "pointer",
    fontWeight: 900,
  },
  btnDanger: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "#b00020",
    color: "white",
    cursor: "pointer",
    fontWeight: 900,
  },
  bigBtn: {
    marginTop: 14,
    width: "100%",
    padding: "14px 14px",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "black",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
    fontSize: 16,
  },
  tip: { marginTop: 10, opacity: 0.75, fontSize: 13 },
  smallMuted: { marginTop: 8, opacity: 0.75, fontSize: 13 },
  fileRow: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  accepts: { fontSize: 12, opacity: 0.7, fontWeight: 800 },
  tabs: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 },
  tab: {
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
    cursor: "pointer",
    fontWeight: 900,
  },
  tabActive: { background: "black", color: "white" },
  itemsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: 12,
  },
  itemCard: {
    border: "1px solid rgba(0,0,0,0.10)",
    borderRadius: 14,
    padding: 10,
    background: "white",
  },
  itemMeta: { marginTop: 8 },
  itemSk: { fontWeight: 900, fontSize: 12, opacity: 0.85, wordBreak: "break-all" },
  itemDesc: { fontSize: 12, opacity: 0.75, marginTop: 4, wordBreak: "break-word" },
  itemBtns: { display: "flex", gap: 10, marginTop: 10 },
  empty: { opacity: 0.7, fontWeight: 800, padding: 10 },
  logBox: {
    marginTop: 10,
    background: "#0b1020",
    color: "#d8e1ff",
    padding: 12,
    borderRadius: 12,
    overflow: "auto",
    maxHeight: 340,
    fontSize: 12,
    lineHeight: 1.35,
  },
};
