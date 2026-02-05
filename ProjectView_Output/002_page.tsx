// Original: app\admin\page.tsx
// app/admin/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type TargetSet = "CENTER" | "SLIDES" | "BG";

type MediaItem = {
  pk: TargetSet;
  sk: string;
  url: string;
  mediaType?: string;
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

// SECTION (Category) -> GROUP (Sub-category)
const CATEGORY_TREE = {
  YouTubeChannels: ["IranPoliticalCommentary", "KingRezaPahlavi", "NewsLive"],
  RevolutionMusic: ["RevolutionRap", "IranNational", "TrumpAct"],
  Old: ["CENTER", "SLIDES", "BG"],
} as const;

type Category1 = keyof typeof CATEGORY_TREE;

function isLikelyVideo(url: string, mediaType?: string) {
  const mt = (mediaType || "").toLowerCase();
  if (mt.startsWith("video/")) return true;
  const u = (url || "").toLowerCase();
  return u.endsWith(".mp4") || u.includes(".mp4?");
}

function isLikelyImage(url: string, mediaType?: string) {
  const mt = (mediaType || "").toLowerCase();
  if (mt.startsWith("image/")) return true;
  const u = (url || "").toLowerCase();
  return u.endsWith(".jpg") || u.endsWith(".jpeg") || u.endsWith(".png") || u.endsWith(".webp") || u.endsWith(".gif");
}

export default function AdminPage() {
  // 1) Token is ALWAYS blank; user enters every time
  const [token, setToken] = useState<string>("");
  const [authorized, setAuthorized] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>("");

  const [busy, setBusy] = useState<boolean>(false);
  const [log, setLog] = useState<string[]>([]);

  // Filters
  const [section, setSection] = useState<Category1>("YouTubeChannels");
  const [group, setGroup] = useState<string>(CATEGORY_TREE.YouTubeChannels[0]);
  const [search, setSearch] = useState<string>("");

  // Upload
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadDesc, setUploadDesc] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Data
  const [centerItems, setCenterItems] = useState<MediaItem[]>([]);
  const [slidesItems, setSlidesItems] = useState<MediaItem[]>([]);
  const [bgItems, setBgItems] = useState<MediaItem[]>([]);

  // Editing state
  const [editingDescSk, setEditingDescSk] = useState<string>("");
  const [editingDescValue, setEditingDescValue] = useState<string>("");

  useEffect(() => {
    // ensure locked on full load
    setToken("");
    setAuthorized(false);
    setAuthError("");
  }, []);

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
      // ignore
    }
    return { ok: res.ok, status: res.status, text, data };
  }

  function clearUpload() {
    setUploadFiles([]);
    setUploadDesc("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function guessContentType(file: File) {
    if (file.type) return file.type;
    const name = file.name.toLowerCase();
    if (name.endsWith(".mp4")) return "video/mp4";
    if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
    if (name.endsWith(".png")) return "image/png";
    if (name.endsWith(".webp")) return "image/webp";
    if (name.endsWith(".gif")) return "image/gif";
    return "application/octet-stream";
  }

  function isMp4(file: File) {
    const ct = guessContentType(file).toLowerCase();
    const name = file.name.toLowerCase();
    return ct === "video/mp4" || name.endsWith(".mp4");
  }

  async function verifyToken() {
    const t = token.trim();
    setAuthError("");

    if (!t) {
      setAuthorized(false);
      setAuthError("Token is required.");
      pushLog("âŒ Missing token");
      return;
    }

    const out = await apiJson("/api/admin/validate", {
      method: "POST",
      headers: { "x-admin-token": t },
      cache: "no-store",
    });

    // Only unlock if backend explicitly says ok/authorized/valid
    const body = out.data;
    const bodyOk =
      body &&
      typeof body === "object" &&
      (body.ok === true || body.authorized === true || body.valid === true) &&
      !body.error;

    if (!out.ok || !bodyOk) {
      setAuthorized(false);
      const msg =
        (body && typeof body === "object" && (body.detail || body.error || body.message)) ||
        `Invalid admin token (HTTP ${out.status})`;
      setAuthError(String(msg));
      pushLog(`âŒ ${msg}`);
      return;
    }

    setAuthorized(true);
    setAuthError("");
    pushLog("âœ… Token accepted");
    await refreshAll();
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

    return Array.isArray((data as any).items) ? ((data as any).items as MediaItem[]) : [];
  }

  async function refreshAll() {
    const t = token.trim();
    if (!t) return;

    setBusy(true);
    try {
      const [c, s, b] = await Promise.all([loadSet("CENTER", t), loadSet("SLIDES", t), loadSet("BG", t)]);
      setCenterItems(c);
      setSlidesItems(s);
      setBgItems(b);
      pushLog(`Loaded: CENTER=${c.length}, SLIDES=${s.length}, BG=${b.length}`);
    } catch (e: any) {
      pushLog(`âŒ ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const groupOptions = useMemo(() => Array.from(CATEGORY_TREE[section]), [section]);

  useEffect(() => {
    setGroup(groupOptions[0] || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  const headerTitle = `${section} â†’ ${group}`;

  const filteredItems: MediaItem[] = useMemo(() => {
    let base: MediaItem[] = [];

    if (section === "Old") {
      const set = (group || "CENTER") as TargetSet;
      if (set === "CENTER") base = centerItems;
      else if (set === "SLIDES") base = slidesItems;
      else base = bgItems;
    } else {
      base = centerItems.filter(
        (it) => (it.category1 || "").trim() === section && (it.category2 || "").trim() === (group || "")
      );
    }

    const q = search.trim().toLowerCase();
    if (!q) return base;

    return base.filter((it) => {
      const hay = [it.sk, it.url, it.description, it.category1, it.category2].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [section, group, centerItems, slidesItems, bgItems, search]);

  function onPickUploadFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files || []);
    setUploadFiles(list);
    if (list.length) pushLog(`Selected ${list.length} file(s)`);
  }

  async function presignOne(set: TargetSet, file: File) {
    const t = token.trim();
    const contentType = encodeURIComponent(guessContentType(file));
    const filename = encodeURIComponent(file.name);

    const out = await apiJson(
      `/api/admin/presign?set=${encodeURIComponent(set)}&filename=${filename}&contentType=${contentType}`,
      { method: "GET", headers: { "x-admin-token": t }, cache: "no-store" }
    );

    if (!out.ok) {
      const msg = out.data?.detail || out.data?.error || out.text || "Presign failed";
      throw new Error(`Presign failed (HTTP ${out.status}) ${msg}`);
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
      headers: { "content-type": "application/json", "x-admin-token": t },
      body: JSON.stringify(item),
    });

    if (!out.ok) {
      const msg = out.data?.detail || out.data?.error || out.text || "Register failed";
      throw new Error(`Register failed (HTTP ${out.status}) ${msg}`);
    }
  }

  async function uploadMovies() {
    if (!authorized) {
      pushLog("âŒ Not authorized");
      return;
    }
    if (section === "Old") {
      pushLog("âŒ Choose a real SECTION (not Old) for uploading movies");
      return;
    }
    if (!uploadFiles.length) {
      pushLog("âŒ Select at least one file");
      return;
    }
    const bad = uploadFiles.find((f) => !isMp4(f));
    if (bad) {
      pushLog(`âŒ Only .mp4 allowed. Bad file: ${bad.name}`);
      return;
    }

    setBusy(true);
    try {
      pushLog(`Uploading ${uploadFiles.length} movie(s) to CENTER...`);

      for (const f of uploadFiles) {
        const pres = await presignOne("CENTER", f);
        const contentType = guessContentType(f);

        const putRes = await fetch(pres.uploadUrl, {
          method: "PUT",
          headers: { "content-type": contentType },
          body: f,
        });
        if (!putRes.ok) throw new Error(`S3 upload failed (HTTP ${putRes.status}) ${f.name}`);

        await registerOne({
          set: "CENTER",
          url: pres.publicUrl,
          mediaType: contentType,
          category1: section,
          category2: group,
          description: uploadDesc.trim(),
        });

        pushLog(`âœ… Uploaded: ${f.name}`);
      }

      clearUpload();
      await refreshAll();
    } catch (e: any) {
      pushLog(`âŒ Upload failed: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function deleteItem(it: MediaItem) {
    if (!authorized) {
      pushLog("âŒ Not authorized");
      return;
    }

    setBusy(true);
    try {
      const t = token.trim();
      const out = await apiJson(
        `/api/admin/slides?set=${encodeURIComponent(it.pk)}&sk=${encodeURIComponent(it.sk)}`,
        { method: "DELETE", headers: { "x-admin-token": t } }
      );

      if (!out.ok) {
        const msg = out.data?.detail || out.data?.error || out.text || "Delete failed";
        throw new Error(`Delete failed (HTTP ${out.status}) ${msg}`);
      }

      pushLog(`ðŸ—‘ï¸ Deleted: ${it.pk} / ${it.sk}`);
      await refreshAll();
    } catch (e: any) {
      pushLog(`âŒ ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  function startEditingDesc(it: MediaItem) {
    setEditingDescSk(it.sk);
    setEditingDescValue(it.description || "");
  }

  function cancelEditingDesc() {
    setEditingDescSk("");
    setEditingDescValue("");
  }

  async function saveDescription(it: MediaItem) {
    if (!authorized) {
      pushLog("âŒ Not authorized");
      return;
    }

    setBusy(true);
    try {
      const t = token.trim();
      const out = await apiJson("/api/admin/slides", {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-admin-token": t },
        body: JSON.stringify({
          set: it.pk,
          sk: it.sk,
          description: editingDescValue.trim(),
        }),
      });

      if (!out.ok) {
        const msg = out.data?.detail || out.data?.error || out.text || "Update failed";
        throw new Error(`Update failed (HTTP ${out.status}) ${msg}`);
      }

      pushLog(`âœï¸ Updated description: ${it.sk}`);
      setEditingDescSk("");
      setEditingDescValue("");
      await refreshAll();
    } catch (e: any) {
      pushLog(`âŒ ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.header}>
          <div>
            <div style={styles.title}>Radio Olgoo Admin</div>
            <div style={styles.subtitle}>Upload movies and manage what's already on the site.</div>
          </div>

          <div style={styles.headerRight}>
            <span
              style={{
                ...styles.pill,
                background: authorized ? "rgba(22,163,74,0.14)" : "rgba(220,38,38,0.14)",
                color: authorized ? "#166534" : "#991b1b",
              }}
            >
              {authorized ? "Authorized" : "Locked"}
            </span>

            <button style={styles.button} onClick={refreshAll} disabled={!authorized || busy}>
              Refresh
            </button>
          </div>
        </header>

        {/* Token at the very top */}
        <section style={styles.tokenCard}>
          <div style={styles.cardHeader}>
            <div>
              <div style={styles.cardTitle}>Admin token</div>
              <div style={styles.cardHint}>Enter the admin token to unlock the rest of this screen.</div>
            </div>
          </div>

          <div style={styles.row}>
            <input
              type="password"
              placeholder="ADMIN_TOKEN"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              style={styles.input}
              autoComplete="off"
              spellCheck={false}
            />
            <button style={styles.buttonPrimary} onClick={verifyToken} disabled={busy}>
              Verify
            </button>
            <button
              style={styles.buttonGhost}
              onClick={() => {
                setToken("");
                setAuthorized(false);
                setAuthError("");
                clearUpload();
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

          {authError ? <div style={styles.authError}>âš ï¸ {authError}</div> : null}
        </section>

        {/* Cloudy overlay + blur until authorized */}
        <div style={styles.gatedWrap}>
          <div style={{ ...styles.gatedContent, ...(authorized ? styles.gateOn : styles.gateOff) }}>
            {/* FILTER BAR */}
            <section style={styles.filterBar}>
              <div style={styles.filterRow}>
                <div style={styles.filterField}>
                  <label style={styles.filterLabel}>SECTION</label>
                  <select
                    value={section}
                    onChange={(e) => setSection(e.target.value as Category1)}
                    style={styles.filterSelect}
                    disabled={busy || !authorized}
                  >
                    {Object.keys(CATEGORY_TREE).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.filterField}>
                  <label style={styles.filterLabel}>GROUP</label>
                  <select
                    value={group}
                    onChange={(e) => setGroup(e.target.value)}
                    style={styles.filterSelect}
                    disabled={busy || !authorized}
                  >
                    {groupOptions.map((sc) => (
                      <option key={sc} value={sc}>
                        {sc}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.filterSearch}>
                  <label style={styles.filterLabel}>SEARCH</label>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="key / URL / descriptionâ€¦"
                    style={styles.filterInput}
                    disabled={busy || !authorized}
                  />
                </div>

                <div style={styles.filterMeta}>
                  <div style={styles.filterCount}>{filteredItems.length} item(s)</div>
                  <div style={styles.filterViewing}>
                    Viewing: <b>{headerTitle}</b>
                  </div>
                </div>
              </div>
            </section>

            {/* UPLOAD SECTION - Now narrower */}
            <section style={styles.uploadCard}>
              <div style={styles.cardHeader}>
                <div>
                  <div style={styles.cardTitle}>Upload movies</div>
                  <div style={styles.cardHint}>Uploads go to CENTER and are tagged with SECTION/GROUP.</div>
                </div>
              </div>

              <div style={styles.uploadGrid}>
                <div style={styles.fieldBlock}>
                  <label style={styles.label}>Description (optional)</label>
                  <input
                    value={uploadDesc}
                    onChange={(e) => setUploadDesc(e.target.value)}
                    placeholder="Short description"
                    style={styles.input}
                    disabled={busy || !authorized}
                  />
                </div>

                <div style={styles.fieldBlock}>
                  <label style={styles.label}>Choose .mp4 file(s)</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="video/mp4"
                    onChange={onPickUploadFiles}
                    disabled={busy || !authorized}
                  />
                  {!!uploadFiles.length ? (
                    <div style={styles.miniNote}>Selected: {uploadFiles.length}</div>
                  ) : (
                    <div style={styles.miniNote}>Tip: you can select multiple mp4 files at once.</div>
                  )}
                </div>

                <button style={styles.bigButton} onClick={uploadMovies} disabled={!authorized || busy}>
                  {busy ? "Working..." : "Upload movie(s)"}
                </button>
              </div>

              <div style={styles.note}>
                Uploading is for <b>mp4</b> movies only. (Old â†’ BG/SLIDES/CENTER is browse-only here.)
              </div>
            </section>

            {/* UPLOADED ITEMS - Now full width below upload */}
            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <div style={styles.cardTitle}>
                    Uploaded items in {section} â†’ {group}
                  </div>
                  <div style={styles.cardHint}>
                    Videos are rendered inline. Click "Edit" to update description, or "Delete" to remove.
                  </div>
                </div>
              </div>

              <div style={styles.items}>
                {filteredItems.map((it) => (
                  <div key={it.sk} style={styles.item}>
                    <div style={styles.itemTop}>
                      <div style={styles.itemLeft}>
                        <div style={styles.itemPk}>{it.pk}</div>
                        <div style={styles.itemSk}>{it.sk}</div>
                      </div>

                      <div style={styles.itemActions}>
                        {editingDescSk === it.sk ? (
                          <>
                            <button
                              style={styles.saveButton}
                              onClick={() => saveDescription(it)}
                              disabled={busy || !authorized}
                            >
                              Save
                            </button>
                            <button
                              style={styles.cancelButton}
                              onClick={cancelEditingDesc}
                              disabled={busy || !authorized}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              style={styles.editButton}
                              onClick={() => startEditingDesc(it)}
                              disabled={busy || !authorized}
                            >
                              Edit
                            </button>
                            <button
                              style={styles.dangerSmall}
                              onClick={() => deleteItem(it)}
                              disabled={busy || !authorized}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div style={styles.itemMeta}>
                      <div style={styles.itemLine}>
                        <span style={styles.dim}>Category:</span>{" "}
                        {[it.category1, it.category2].filter(Boolean).join(" Â· ") || "â€”"}
                      </div>

                      {/* Description editing */}
                      {editingDescSk === it.sk ? (
                        <div style={styles.fieldBlock}>
                          <label style={styles.label}>Description</label>
                          <input
                            value={editingDescValue}
                            onChange={(e) => setEditingDescValue(e.target.value)}
                            placeholder="Enter description"
                            style={styles.input}
                            disabled={busy || !authorized}
                            autoFocus
                          />
                        </div>
                      ) : it.description ? (
                        <div style={styles.itemLine}>
                          <span style={styles.dim}>Desc:</span> {it.description}
                        </div>
                      ) : (
                        <div style={{ ...styles.itemLine, opacity: 0.5 }}>
                          <span style={styles.dim}>Desc:</span> (no description)
                        </div>
                      )}

                      {/* Inline render (image/video) */}
                      <div style={styles.previewBox}>
                        {isLikelyVideo(it.url, it.mediaType) ? (
                          <video key={it.url} src={it.url} controls preload="metadata" style={styles.video} />
                        ) : isLikelyImage(it.url, it.mediaType) ? (
                          <img src={it.url} alt={it.sk} style={styles.image} />
                        ) : (
                          <div style={styles.previewFallback}>No inline preview for this file type.</div>
                        )}
                      </div>

                      {/* Keep "Open" link as optional */}
                      <div style={{ ...styles.itemLine, wordBreak: "break-all" }}>
                        <a href={it.url} target="_blank" rel="noreferrer" style={styles.link}>
                          Open in new tab
                        </a>
                      </div>
                    </div>
                  </div>
                ))}

                {!filteredItems.length ? (
                  <div style={styles.empty}>
                    Nothing uploaded in <b>{headerTitle}</b> yet.
                  </div>
                ) : null}
              </div>
            </section>

            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <div style={styles.cardTitle}>Log</div>
                <button style={styles.buttonGhost} onClick={() => setLog([])} disabled={busy || !authorized}>
                  Clear
                </button>
              </div>
              <pre style={styles.logBox}>{log.join("\n")}</pre>
            </section>
          </div>

          {!authorized ? (
            <div style={styles.cloudOverlay} aria-hidden="true">
              <div style={styles.cloudCard}>
                <div style={styles.cloudTitle}>Locked</div>
                <div style={styles.cloudText}>Enter a valid admin token above to unlock this screen.</div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #f7f7fb 0%, #f2f4f8 100%)",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    color: "#0f172a",
  },
  shell: { maxWidth: 1200, margin: "0 auto", padding: 18 },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 10,
  },
  headerRight: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  title: { fontSize: 28, fontWeight: 950, letterSpacing: -0.3 },
  subtitle: { marginTop: 4, opacity: 0.72, fontSize: 13 },

  tokenCard: {
    background: "rgba(255,255,255,0.95)",
    borderRadius: 18,
    border: "1px solid rgba(15, 23, 42, 0.10)",
    boxShadow: "0 20px 60px rgba(2, 6, 23, 0.08)",
    padding: 14,
    marginBottom: 14,
    maxWidth: 800,
    margin: "0 auto 14px auto",
  },

  gatedWrap: { position: "relative" },
  gatedContent: { transition: "filter 160ms ease, opacity 160ms ease" },
  gateOn: { opacity: 1, filter: "none", pointerEvents: "auto" },
  gateOff: { opacity: 0.35, filter: "blur(3px) saturate(0.9)", pointerEvents: "none", userSelect: "none" },

  cloudOverlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    paddingTop: 80,
    pointerEvents: "none",
  },
  cloudCard: {
    width: "min(560px, 92%)",
    borderRadius: 18,
    border: "1px solid rgba(15, 23, 42, 0.12)",
    background: "rgba(255,255,255,0.72)",
    backdropFilter: "blur(10px)",
    boxShadow: "0 20px 60px rgba(2, 6, 23, 0.10)",
    padding: 14,
    textAlign: "center",
  },
  cloudTitle: { fontWeight: 950, fontSize: 16 },
  cloudText: { marginTop: 6, opacity: 0.75, fontSize: 13, fontWeight: 650 },

  filterBar: {
    position: "sticky",
    top: 0,
    zIndex: 20,
    marginBottom: 14,
    background: "rgba(255,255,255,0.92)",
    borderRadius: 18,
    border: "1px solid rgba(15, 23, 42, 0.10)",
    boxShadow: "0 20px 60px rgba(2, 6, 23, 0.06)",
    padding: 14,
    backdropFilter: "blur(8px)",
  },
  filterRow: { display: "flex", gap: 22, alignItems: "end", flexWrap: "wrap" },
  filterField: { minWidth: 280 },
  filterLabel: { display: "block", fontWeight: 950, fontSize: 22, marginBottom: 10, letterSpacing: 0.2 },
  filterSelect: {
    width: "100%",
    padding: "16px 18px",
    borderRadius: 16,
    border: "3px solid rgba(15, 23, 42, 0.85)",
    background: "white",
    fontWeight: 800,
    outline: "none",
    fontSize: 18,
  },
  filterSearch: { flex: 1, minWidth: 320 },
  filterInput: {
    width: "100%",
    padding: "16px 18px",
    borderRadius: 16,
    border: "3px solid rgba(15, 23, 42, 0.85)",
    background: "white",
    outline: "none",
    fontWeight: 700,
    fontSize: 18,
  },
  filterMeta: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    alignItems: "flex-end",
    marginLeft: "auto",
    minWidth: 200,
  },
  filterCount: {
    fontWeight: 950,
    fontSize: 14,
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(15, 23, 42, 0.12)",
    background: "rgba(15, 23, 42, 0.04)",
  },
  filterViewing: { fontSize: 13, opacity: 0.75 },

  card: {
    background: "rgba(255,255,255,0.9)",
    borderRadius: 18,
    border: "1px solid rgba(15, 23, 42, 0.08)",
    boxShadow: "0 20px 60px rgba(2, 6, 23, 0.06)",
    padding: 14,
    marginBottom: 14,
    backdropFilter: "blur(6px)",
  },
  uploadCard: {
    background: "rgba(255,255,255,0.9)",
    borderRadius: 18,
    border: "1px solid rgba(15, 23, 42, 0.08)",
    boxShadow: "0 20px 60px rgba(2, 6, 23, 0.06)",
    padding: 14,
    marginBottom: 14,
    backdropFilter: "blur(6px)",
    maxWidth: 800,
    margin: "0 auto 14px auto",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 10,
  },
  cardTitle: { fontWeight: 950, fontSize: 16, letterSpacing: -0.1 },
  cardHint: { opacity: 0.65, fontSize: 12 },

  row: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
  label: { display: "block", fontWeight: 850, marginBottom: 6, fontSize: 12, opacity: 0.85 },

  input: {
    width: "100%",
    padding: "11px 12px",
    borderRadius: 14,
    border: "1px solid rgba(15, 23, 42, 0.14)",
    background: "rgba(255,255,255,0.95)",
    outline: "none",
  },

  pill: {
    padding: "7px 10px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 12,
    border: "1px solid rgba(15, 23, 42, 0.10)",
  },

  button: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(15, 23, 42, 0.12)",
    background: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontWeight: 900,
  },
  buttonGhost: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(15, 23, 42, 0.10)",
    background: "transparent",
    cursor: "pointer",
    fontWeight: 900,
  },
  buttonPrimary: {
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px solid rgba(15, 23, 42, 0.12)",
    background: "#0f172a",
    color: "white",
    cursor: "pointer",
    fontWeight: 950,
  },
  bigButton: {
    marginTop: 12,
    width: "100%",
    padding: "14px 14px",
    borderRadius: 16,
    border: "1px solid rgba(15, 23, 42, 0.12)",
    background: "#0f172a",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
    fontSize: 16,
  },

  uploadGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr auto",
    gap: 14,
    alignItems: "end",
  },

  fieldBlock: { marginTop: 10 },
  note: { marginTop: 10, opacity: 0.72, fontSize: 13 },
  miniNote: { marginTop: 8, opacity: 0.72, fontSize: 12, fontWeight: 800 },

  items: { display: "grid", gridTemplateColumns: "1fr", gap: 10, marginTop: 12 },
  item: {
    border: "1px solid rgba(15, 23, 42, 0.10)",
    borderRadius: 16,
    padding: 12,
    background: "white",
    boxShadow: "0 10px 24px rgba(2, 6, 23, 0.04)",
  },
  itemTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  itemLeft: { display: "flex", flexDirection: "column", gap: 4 },
  itemPk: { fontWeight: 950, fontSize: 12, opacity: 0.7 },
  itemSk: { fontWeight: 950, fontSize: 13, wordBreak: "break-all" },
  itemActions: { display: "flex", gap: 8, flexWrap: "wrap" },
  itemMeta: { marginTop: 10, display: "flex", flexDirection: "column", gap: 10 },
  itemLine: { fontSize: 13, opacity: 0.9 },
  dim: { opacity: 0.7, fontWeight: 800 },
  link: { fontWeight: 900, textDecoration: "underline" },

  previewBox: {
    borderRadius: 14,
    border: "1px solid rgba(15, 23, 42, 0.10)",
    background: "rgba(15, 23, 42, 0.02)",
    padding: 10,
  },
  video: {
    width: "100%",
    maxHeight: 280,
    borderRadius: 12,
    display: "block",
    background: "#000",
  },
  image: {
    width: "100%",
    maxHeight: 280,
    objectFit: "contain",
    borderRadius: 12,
    display: "block",
    background: "#fff",
  },
  previewFallback: {
    padding: 12,
    borderRadius: 12,
    border: "1px dashed rgba(15, 23, 42, 0.18)",
    opacity: 0.75,
    fontWeight: 800,
    fontSize: 12,
  },

  editButton: {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(59, 130, 246, 0.25)",
    background: "rgba(59, 130, 246, 0.12)",
    color: "#1e40af",
    cursor: "pointer",
    fontWeight: 950,
  },
  saveButton: {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(34, 197, 94, 0.25)",
    background: "rgba(34, 197, 94, 0.12)",
    color: "#15803d",
    cursor: "pointer",
    fontWeight: 950,
  },
  cancelButton: {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(107, 114, 128, 0.25)",
    background: "rgba(107, 114, 128, 0.12)",
    color: "#374151",
    cursor: "pointer",
    fontWeight: 950,
  },
  dangerSmall: {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(185, 28, 28, 0.25)",
    background: "rgba(220, 38, 38, 0.12)",
    color: "#991b1b",
    cursor: "pointer",
    fontWeight: 950,
  },

  empty: {
    opacity: 0.7,
    fontWeight: 850,
    padding: 12,
    borderRadius: 16,
    border: "1px dashed rgba(15, 23, 42, 0.18)",
    background: "rgba(15, 23, 42, 0.02)",
  },

  logBox: {
    marginTop: 10,
    background: "#0b0b0b",
    color: "#d7ffd7",
    padding: 12,
    borderRadius: 14,
    overflow: "auto",
    maxHeight: 260,
    fontSize: 12,
  },

  authError: {
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(185, 28, 28, 0.25)",
    background: "rgba(220, 38, 38, 0.10)",
    color: "#991b1b",
    fontWeight: 900,
    fontSize: 13,
  },
};
