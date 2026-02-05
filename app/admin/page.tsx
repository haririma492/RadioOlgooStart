// app/admin/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type MediaItem = {
  PK: string;
  url: string;
  section: string;
  title: string;
  group?: string;
  person?: string;
  date?: string;
  description?: string;
  active?: boolean;
  createdAt?: string;
};

type ItemsGetResponse = { ok: true; items: MediaItem[]; count?: number } | { error: string };

function nowTime() {
  return new Date().toLocaleTimeString([], { hour12: true });
}

// Section to Groups mapping
const SECTION_GROUPS: Record<string, string[]> = {
  "Video Archives": ["Conference", "Interview", "Workshop", "Lecture", "Panel Discussion"],
  "Single Videos-Songs": ["Pop", "Classical", "Jazz", "Rock", "Traditional", "Folk"],
  "National Anthems": ["Iran", "Canada", "USA", "France", "Germany", "Other"],
  "Photo Albums": [],
  "Live Channels": ["News", "Music", "Entertainment", "Sports"],
  "Social Media Profiles": ["X", "YouTube", "Instagram", "Facebook", "TikTok"],
  "Great-National-Songs-Videos": ["Patriotic", "Historical", "Contemporary"],
  "In-Transition": ["Pending", "Review", "Archive"],
};

type Section = keyof typeof SECTION_GROUPS;

function isVideo(url: string): boolean {
  const u = (url || "").toLowerCase();
  return u.includes(".mp4") || u.includes("video");
}

function isImage(url: string): boolean {
  const u = (url || "").toLowerCase();
  return u.includes(".jpg") || u.includes(".jpeg") || u.includes(".png") || u.includes(".webp");
}

export default function AdminPage() {
  const [token, setToken] = useState<string>("");
  const [authorized, setAuthorized] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>("");

  const [busy, setBusy] = useState<boolean>(false);
  const [log, setLog] = useState<string[]>([]);

  // Filters
  const [section, setSection] = useState<Section>("Video Archives");
  const [group, setGroup] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  // Upload fields
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadTitle, setUploadTitle] = useState<string>("");
  const [uploadPerson, setUploadPerson] = useState<string>("");
  const [uploadDate, setUploadDate] = useState<string>("");
  const [uploadDescription, setUploadDescription] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Data
  const [items, setItems] = useState<MediaItem[]>([]);

  // Editing state
  const [editingPK, setEditingPK] = useState<string>("");
  const [editingFields, setEditingFields] = useState<Partial<MediaItem>>({});

  useEffect(() => {
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
    } catch {}
    return { ok: res.ok, status: res.status, text, data };
  }

  function clearUpload() {
    setUploadFiles([]);
    setUploadTitle("");
    setUploadPerson("");
    setUploadDate("");
    setUploadDescription("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function guessContentType(file: File) {
    if (file.type) return file.type;
    const name = file.name.toLowerCase();
    if (name.endsWith(".mp4")) return "video/mp4";
    if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
    if (name.endsWith(".png")) return "image/png";
    if (name.endsWith(".webp")) return "image/webp";
    return "application/octet-stream";
  }

  async function verifyToken() {
    const t = token.trim();
    setAuthError("");

    if (!t) {
      setAuthorized(false);
      setAuthError("Token is required.");
      pushLog("❌ Missing token");
      return;
    }

    const out = await apiJson("/api/admin/validate", {
      method: "POST",
      headers: { "x-admin-token": t },
      cache: "no-store",
    });

    const body = out.data;
    const bodyOk = body && typeof body === "object" && body.ok === true && !body.error;

    if (!out.ok || !bodyOk) {
      setAuthorized(false);
      const msg = (body && (body.detail || body.error || body.message)) || `Invalid token (HTTP ${out.status})`;
      setAuthError(String(msg));
      pushLog(`❌ ${msg}`);
      return;
    }

    setAuthorized(true);
    setAuthError("");
    pushLog("✅ Token accepted");
    await refreshAll();
  }

  async function refreshAll() {
    const t = token.trim();
    if (!t) return;

    setBusy(true);
    try {
      const out = await apiJson(`/api/admin/slides?section=${encodeURIComponent(section)}${group ? `&group=${encodeURIComponent(group)}` : ""}`, {
        method: "GET",
        headers: { "x-admin-token": t },
        cache: "no-store",
      });

      if (!out.ok) {
        throw new Error(`Load failed (HTTP ${out.status})`);
      }

      const data = out.data as ItemsGetResponse;
      if ((data as any).error) {
        throw new Error((data as any).error);
      }

      const loadedItems = (data as any).items || [];
      setItems(loadedItems);
      pushLog(`Loaded: ${loadedItems.length} items`);
    } catch (e: any) {
      pushLog(`❌ ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const groupOptions = useMemo(() => SECTION_GROUPS[section] || [], [section]);

  useEffect(() => {
    setGroup(groupOptions[0] || "");
  }, [section]);

  const filteredItems: MediaItem[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;

    return items.filter((it) => {
      const hay = [it.PK, it.url, it.title, it.description, it.person].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [items, search]);

  function onPickUploadFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files || []);
    setUploadFiles(list);
    if (list.length) pushLog(`Selected ${list.length} file(s)`);
  }

  async function presignOne(file: File) {
    const t = token.trim();
    const contentType = encodeURIComponent(guessContentType(file));
    const filename = encodeURIComponent(file.name);

    const out = await apiJson(
      `/api/admin/presign?section=${encodeURIComponent(section)}&filename=${filename}&contentType=${contentType}`,
      { method: "GET", headers: { "x-admin-token": t }, cache: "no-store" }
    );

    if (!out.ok) {
      const msg = out.data?.detail || out.data?.error || "Presign failed";
      throw new Error(`Presign failed (HTTP ${out.status}) ${msg}`);
    }
    return out.data as { ok: true; uploadUrl: string; publicUrl: string; key: string };
  }

  async function registerOne(item: {
    url: string;
    section: string;
    title: string;
    group?: string;
    person?: string;
    date?: string;
    description?: string;
  }) {
    const t = token.trim();
    const out = await apiJson("/api/admin/slides", {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-token": t },
      body: JSON.stringify(item),
    });

    if (!out.ok) {
      const msg = out.data?.detail || out.data?.error || "Register failed";
      throw new Error(`Register failed (HTTP ${out.status}) ${msg}`);
    }
  }

  async function uploadMedia() {
    if (!authorized) {
      pushLog("❌ Not authorized");
      return;
    }
    if (!uploadTitle.trim()) {
      pushLog("❌ Title is required");
      return;
    }
    if (!uploadFiles.length) {
      pushLog("❌ Select at least one file");
      return;
    }

    setBusy(true);
    try {
      pushLog(`Uploading ${uploadFiles.length} file(s)...`);

      for (const f of uploadFiles) {
        const pres = await presignOne(f);
        const contentType = guessContentType(f);

        const putRes = await fetch(pres.uploadUrl, {
          method: "PUT",
          headers: { "content-type": contentType },
          body: f,
        });
        if (!putRes.ok) throw new Error(`S3 upload failed (HTTP ${putRes.status}) ${f.name}`);

        await registerOne({
          url: pres.publicUrl,
          section,
          title: uploadTitle.trim(),
          group: group || undefined,
          person: uploadPerson.trim() || undefined,
          date: uploadDate.trim() || undefined,
          description: uploadDescription.trim() || undefined,
        });

        pushLog(`✅ Uploaded: ${f.name}`);
      }

      clearUpload();
      await refreshAll();
    } catch (e: any) {
      pushLog(`❌ Upload failed: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function deleteItem(it: MediaItem) {
    if (!authorized) return;

    setBusy(true);
    try {
      const t = token.trim();
      const out = await apiJson(`/api/admin/slides?PK=${encodeURIComponent(it.PK)}`, {
        method: "DELETE",
        headers: { "x-admin-token": t },
      });

      if (!out.ok) {
        const msg = out.data?.detail || out.data?.error || "Delete failed";
        throw new Error(`Delete failed (HTTP ${out.status}) ${msg}`);
      }

      pushLog(`🗑️ Deleted: ${it.PK}`);
      await refreshAll();
    } catch (e: any) {
      pushLog(`❌ ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  function startEditing(it: MediaItem) {
    setEditingPK(it.PK);
    setEditingFields({
      title: it.title,
      description: it.description || "",
      person: it.person || "",
      date: it.date || "",
    });
  }

  function cancelEditing() {
    setEditingPK("");
    setEditingFields({});
  }

  async function saveEditing(it: MediaItem) {
    if (!authorized) return;

    setBusy(true);
    try {
      const t = token.trim();
      const out = await apiJson("/api/admin/slides", {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-admin-token": t },
        body: JSON.stringify({
          PK: it.PK,
          ...editingFields,
        }),
      });

      if (!out.ok) {
        const msg = out.data?.detail || out.data?.error || "Update failed";
        throw new Error(`Update failed (HTTP ${out.status}) ${msg}`);
      }

      pushLog(`✏️ Updated: ${it.PK}`);
      setEditingPK("");
      setEditingFields({});
      await refreshAll();
    } catch (e: any) {
      pushLog(`❌ ${e?.message ?? String(e)}`);
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
            <div style={styles.subtitle}>Upload and manage media across all sections.</div>
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

        {/* Token Section */}
        <section style={styles.tokenCard}>
          <div style={styles.cardHeader}>
            <div>
              <div style={styles.cardTitle}>Admin token</div>
              <div style={styles.cardHint}>Enter the admin token to unlock this screen.</div>
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
                setItems([]);
                pushLog("Logged out");
              }}
              disabled={busy}
            >
              Log out
            </button>
          </div>

          {authError ? <div style={styles.authError}>⚠️ {authError}</div> : null}
        </section>

        {/* Gated Content */}
        <div style={styles.gatedWrap}>
          <div style={{ ...styles.gatedContent, ...(authorized ? styles.gateOn : styles.gateOff) }}>
            {/* Filter Bar */}
            <section style={styles.filterBar}>
              <div style={styles.filterRow}>
                <div style={styles.filterField}>
                  <label style={styles.filterLabel}>SECTION</label>
                  <select
                    value={section}
                    onChange={(e) => setSection(e.target.value as Section)}
                    style={styles.filterSelect}
                    disabled={busy || !authorized}
                  >
                    {Object.keys(SECTION_GROUPS).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {groupOptions.length > 0 && (
                  <div style={styles.filterField}>
                    <label style={styles.filterLabel}>GROUP</label>
                    <select
                      value={group}
                      onChange={(e) => setGroup(e.target.value)}
                      style={styles.filterSelect}
                      disabled={busy || !authorized}
                    >
                      {groupOptions.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={styles.filterSearch}>
                  <label style={styles.filterLabel}>SEARCH</label>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="PK / title / description…"
                    style={styles.filterInput}
                    disabled={busy || !authorized}
                  />
                </div>

                <div style={styles.filterMeta}>
                  <div style={styles.filterCount}>{filteredItems.length} item(s)</div>
                  <div style={styles.filterViewing}>
                    Viewing: <b>{section}{group ? ` → ${group}` : ""}</b>
                  </div>
                </div>
              </div>
            </section>

            {/* Upload Section */}
            <section style={styles.uploadCard}>
              <div style={styles.cardHeader}>
                <div>
                  <div style={styles.cardTitle}>Upload media</div>
                  <div style={styles.cardHint}>Files are tagged with current section/group.</div>
                </div>
              </div>

              <div style={styles.uploadGrid}>
                <div style={styles.fieldBlock}>
                  <label style={styles.label}>Title (required)</label>
                  <input
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="Enter title"
                    style={styles.input}
                    disabled={busy || !authorized}
                  />
                </div>

                <div style={styles.fieldBlock}>
                  <label style={styles.label}>Person (optional)</label>
                  <input
                    value={uploadPerson}
                    onChange={(e) => setUploadPerson(e.target.value)}
                    placeholder="Speaker/Artist name"
                    style={styles.input}
                    disabled={busy || !authorized}
                  />
                </div>

                <div style={styles.fieldBlock}>
                  <label style={styles.label}>Date (optional)</label>
                  <input
                    type="date"
                    value={uploadDate}
                    onChange={(e) => setUploadDate(e.target.value)}
                    style={styles.input}
                    disabled={busy || !authorized}
                  />
                </div>
              </div>

              <div style={styles.fieldBlock}>
                <label style={styles.label}>Description (optional)</label>
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="Brief description"
                  style={{ ...styles.input, minHeight: 60, resize: "vertical" }}
                  disabled={busy || !authorized}
                />
              </div>

              <div style={styles.fieldBlock}>
                <label style={styles.label}>Choose file(s)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="video/*,image/*"
                  onChange={onPickUploadFiles}
                  disabled={busy || !authorized}
                />
                {uploadFiles.length > 0 && <div style={styles.miniNote}>Selected: {uploadFiles.length}</div>}
              </div>

              <button style={styles.bigButton} onClick={uploadMedia} disabled={!authorized || busy}>
                {busy ? "Working..." : "Upload"}
              </button>
            </section>

            {/* Items List */}
            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <div style={styles.cardTitle}>Items in {section}{group ? ` → ${group}` : ""}</div>
                  <div style={styles.cardHint}>Edit details or delete items below.</div>
                </div>
              </div>

              <div style={styles.items}>
                {filteredItems.map((it) => (
                  <div key={it.PK} style={styles.item}>
                    <div style={styles.itemTop}>
                      <div style={styles.itemLeft}>
                        <div style={styles.itemPK}>{it.PK}</div>
                        <div style={styles.itemTitle}>{it.title}</div>
                      </div>

                      <div style={styles.itemActions}>
                        {editingPK === it.PK ? (
                          <>
                            <button style={styles.saveButton} onClick={() => saveEditing(it)} disabled={busy}>
                              Save
                            </button>
                            <button style={styles.cancelButton} onClick={cancelEditing} disabled={busy}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button style={styles.editButton} onClick={() => startEditing(it)} disabled={busy}>
                              Edit
                            </button>
                            <button style={styles.dangerSmall} onClick={() => deleteItem(it)} disabled={busy}>
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div style={styles.itemMeta}>
                      {editingPK === it.PK ? (
                        <>
                          <div style={styles.fieldBlock}>
                            <label style={styles.label}>Title</label>
                            <input
                              value={editingFields.title || ""}
                              onChange={(e) => setEditingFields({ ...editingFields, title: e.target.value })}
                              style={styles.input}
                            />
                          </div>
                          <div style={styles.fieldBlock}>
                            <label style={styles.label}>Person</label>
                            <input
                              value={editingFields.person || ""}
                              onChange={(e) => setEditingFields({ ...editingFields, person: e.target.value })}
                              style={styles.input}
                            />
                          </div>
                          <div style={styles.fieldBlock}>
                            <label style={styles.label}>Date</label>
                            <input
                              type="date"
                              value={editingFields.date || ""}
                              onChange={(e) => setEditingFields({ ...editingFields, date: e.target.value })}
                              style={styles.input}
                            />
                          </div>
                          <div style={styles.fieldBlock}>
                            <label style={styles.label}>Description</label>
                            <textarea
                              value={editingFields.description || ""}
                              onChange={(e) => setEditingFields({ ...editingFields, description: e.target.value })}
                              style={{ ...styles.input, minHeight: 60, resize: "vertical" }}
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          {it.group && (
                            <div style={styles.itemLine}>
                              <span style={styles.dim}>Group:</span> {it.group}
                            </div>
                          )}
                          {it.person && (
                            <div style={styles.itemLine}>
                              <span style={styles.dim}>Person:</span> {it.person}
                            </div>
                          )}
                          {it.date && (
                            <div style={styles.itemLine}>
                              <span style={styles.dim}>Date:</span> {it.date}
                            </div>
                          )}
                          {it.description && (
                            <div style={styles.itemLine}>
                              <span style={styles.dim}>Desc:</span> {it.description}
                            </div>
                          )}
                        </>
                      )}

                      <div style={styles.previewBox}>
                        {isVideo(it.url) ? (
                          <video key={it.url} src={it.url} controls preload="metadata" style={styles.video} />
                        ) : isImage(it.url) ? (
                          <img src={it.url} alt={it.title} style={styles.image} />
                        ) : (
                          <div style={styles.previewFallback}>No preview available</div>
                        )}
                      </div>

                      <div style={{ ...styles.itemLine, wordBreak: "break-all" }}>
                        <a href={it.url} target="_blank" rel="noreferrer" style={styles.link}>
                          Open in new tab
                        </a>
                      </div>
                    </div>
                  </div>
                ))}

                {!filteredItems.length && (
                  <div style={styles.empty}>
                    Nothing uploaded in <b>{section}{group ? ` → ${group}` : ""}</b> yet.
                  </div>
                )}
              </div>
            </section>

            {/* Log */}
            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <div style={styles.cardTitle}>Log</div>
                <button style={styles.buttonGhost} onClick={() => setLog([])} disabled={busy}>
                  Clear
                </button>
              </div>
              <pre style={styles.logBox}>{log.join("\n")}</pre>
            </section>
          </div>

          {!authorized && (
            <div style={styles.cloudOverlay}>
              <div style={styles.cloudCard}>
                <div style={styles.cloudTitle}>Locked</div>
                <div style={styles.cloudText}>Enter a valid admin token above to unlock this screen.</div>
              </div>
            </div>
          )}
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
  gateOff: { opacity: 0.35, filter: "blur(3px)", pointerEvents: "none" },
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
  filterField: { minWidth: 200 },
  filterLabel: { display: "block", fontWeight: 950, fontSize: 22, marginBottom: 10 },
  filterSelect: {
    width: "100%",
    padding: "16px 18px",
    borderRadius: 16,
    border: "3px solid rgba(15, 23, 42, 0.85)",
    background: "white",
    fontWeight: 800,
    fontSize: 18,
  },
  filterSearch: { flex: 1, minWidth: 280 },
  filterInput: {
    width: "100%",
    padding: "16px 18px",
    borderRadius: 16,
    border: "3px solid rgba(15, 23, 42, 0.85)",
    background: "white",
    fontWeight: 700,
    fontSize: 18,
  },
  filterMeta: { display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end", marginLeft: "auto" },
  filterCount: {
    fontWeight: 950,
    fontSize: 14,
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(15, 23, 42, 0.12)",
    background: "rgba(15, 23, 42, 0.04)",
  },
  filterViewing: { fontSize: 13, opacity: 0.75 },
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
  card: {
    background: "rgba(255,255,255,0.9)",
    borderRadius: 18,
    border: "1px solid rgba(15, 23, 42, 0.08)",
    boxShadow: "0 20px 60px rgba(2, 6, 23, 0.06)",
    padding: 14,
    marginBottom: 14,
    backdropFilter: "blur(6px)",
  },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 10 },
  cardTitle: { fontWeight: 950, fontSize: 16 },
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
    padding: "14px",
    borderRadius: 16,
    border: "1px solid rgba(15, 23, 42, 0.12)",
    background: "#0f172a",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
    fontSize: 16,
  },
  uploadGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, alignItems: "end" },
  fieldBlock: { marginTop: 10 },
  miniNote: { marginTop: 8, opacity: 0.72, fontSize: 12, fontWeight: 800 },
  items: { display: "grid", gap: 10, marginTop: 12 },
  item: {
    border: "1px solid rgba(15, 23, 42, 0.10)",
    borderRadius: 16,
    padding: 12,
    background: "white",
    boxShadow: "0 10px 24px rgba(2, 6, 23, 0.04)",
  },
  itemTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  itemLeft: { display: "flex", flexDirection: "column", gap: 4 },
  itemPK: { fontWeight: 950, fontSize: 12, opacity: 0.7 },
  itemTitle: { fontWeight: 950, fontSize: 14 },
  itemActions: { display: "flex", gap: 8 },
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
  video: { width: "100%", maxHeight: 280, borderRadius: 12, display: "block", background: "#000" },
  image: { width: "100%", maxHeight: 280, objectFit: "contain", borderRadius: 12, display: "block" },
  previewFallback: { padding: 12, opacity: 0.75, fontWeight: 800, fontSize: 12 },
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