// app/admin/page.tsx
//
// FULLY DYNAMIC: Sections and groups are derived from data in DynamoDB.
// No hardcoded section list. "Add New..." lets you create new ones on the fly.
//
"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────
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

const ALL = "__ALL__"; // sentinel for "show everything"

function nowTime() {
  return new Date().toLocaleTimeString([], { hour12: true });
}

function isVideo(url: string): boolean {
  const u = (url || "").toLowerCase();
  return u.includes(".mp4") || u.includes("video");
}

function isImage(url: string): boolean {
  const u = (url || "").toLowerCase();
  return u.includes(".jpg") || u.includes(".jpeg") || u.includes(".png") || u.includes(".webp");
}

// ── Default sections & groups (used only as fallback when no data exists) ─────
const DEFAULT_SECTION_GROUPS: Record<string, string[]> = {
  "Video Archives": ["Conference", "Interview", "Workshop", "Lecture", "Panel Discussion"],
  "Single Videos-Songs": ["Pop", "Classical", "Jazz", "Rock", "Traditional", "Folk"],
  "National Anthems": ["Iran", "Canada", "USA", "France", "Germany", "Other"],
  "Photo Albums": [],
  "Live Channels": ["News", "Music", "Entertainment", "Sports"],
  "Social Media Profiles": ["X", "YouTube", "Instagram", "Facebook", "TikTok"],
  "Great-National-Songs-Videos": ["Patriotic", "Historical", "Contemporary"],
  "In-Transition": ["Pending", "Review", "Archive"],
};

// ── Build section→groups map STRICTLY from items + known groups ──────
function buildSectionMap(
  items: MediaItem[],
  knownGroups: Record<string, Set<string>>
): Record<string, string[]> {
  const map: Record<string, Set<string>> = { ...knownGroups };

  // Add real data (overrides anything)
  for (const it of items) {
    const sec = (it.section || "").trim();
    if (!sec) continue;

    if (!map[sec]) map[sec] = new Set();

    const grp = (it.group || "").trim();
    if (grp) map[sec].add(grp);
  }

  const result: Record<string, string[]> = {};
  for (const sec of Object.keys(map).sort()) {
    result[sec] = Array.from(map[sec]).sort();
  }

  return result;
}

export default function AdminPage() {
  const [token, setToken] = useState<string>("");
  const [authorized, setAuthorized] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>("");

  const [busy, setBusy] = useState<boolean>(false);
  const [log, setLog] = useState<string[]>([]);

  const [allItems, setAllItems] = useState<MediaItem[]>([]);

  const [section, setSection] = useState<string>(ALL);
  const [group, setGroup] = useState<string>(ALL);
  const [search, setSearch] = useState<string>("");

  const [uploadMode, setUploadMode] = useState<"file" | "url">("file");

  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadUrl, setUploadUrl] = useState<string>("");
  const [uploadTitle, setUploadTitle] = useState<string>("");
  const [uploadPerson, setUploadPerson] = useState<string>("");
  const [uploadDate, setUploadDate] = useState<string>("");
  const [uploadDescription, setUploadDescription] = useState<string>("");
  const [uploadSection, setUploadSection] = useState<string>("");
  const [uploadGroup, setUploadGroup] = useState<string>("");
  const [uploadNewSection, setUploadNewSection] = useState<string>("");
  const [uploadNewGroup, setUploadNewGroup] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [editingPK, setEditingPK] = useState<string>("");
  const [editingFields, setEditingFields] = useState<Partial<MediaItem>>({});
  const [editNewSection, setEditNewSection] = useState<string>("");
  const [editNewGroup, setEditNewGroup] = useState<string>("");

  const [showDeleteSectionModal, setShowDeleteSectionModal] = useState(false);
  const [showDeleteGroupModal, setShowDeleteGroupModal] = useState(false);
  const [sectionToDelete, setSectionToDelete] = useState<string>("");
  const [groupToDelete, setGroupToDelete] = useState<string>("");
  const [targetSection, setTargetSection] = useState<string>("");
  const [targetGroup, setTargetGroup] = useState<string>(ALL);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Track known groups (newly created ones) so they appear even without items
  const [knownGroups, setKnownGroups] = useState<Record<string, Set<string>>>({});

  // ── Derived: dynamic section → groups map ────────────────────────────
  const sectionMap = useMemo(
    () => buildSectionMap(allItems, knownGroups),
    [allItems, knownGroups]
  );
  const sectionList = useMemo(() => Object.keys(sectionMap).sort(), [sectionMap]);

  const groupOptions = useMemo(() => {
    if (section === ALL) {
      const all = new Set<string>();
      for (const groups of Object.values(sectionMap)) {
        for (const g of groups) all.add(g);
      }
      return Array.from(all).sort();
    }
    return sectionMap[section] || [];
  }, [sectionMap, section]);

  const allGroupOptions = useMemo(() => {
    const all = new Set<string>();
    for (const groups of Object.values(sectionMap)) {
      for (const g of groups) all.add(g);
    }
    return Array.from(all).sort();
  }, [sectionMap]);

  const sectionItemCount = useMemo(() => 
    section !== ALL ? allItems.filter(i => i.section === section).length : 0,
    [allItems, section]
  );

  const groupItemCount = useMemo(() => 
    group !== ALL ? allItems.filter(i => i.section === section && i.group === group).length : 0,
    [allItems, section, group]
  );

  useEffect(() => {
    setToken("");
    setAuthorized(false);
    setAuthError("");
  }, []);

  useEffect(() => {
    setGroup(ALL);
  }, [section]);

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
    setUploadUrl("");
    setUploadTitle("");
    setUploadPerson("");
    setUploadDate("");
    setUploadDescription("");
    setUploadNewSection("");
    setUploadNewGroup("");
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

  // ── Auth ──────────────────────────────────────────────────────────────
  async function verifyToken() {
    const t = token.trim();
    setAuthError("");
    if (!t) {
      setAuthorized(false);
      setAuthError("Token is required.");
      pushLog("\u274C Missing token");
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
      pushLog(`\u274C ${msg}`);
      return;
    }
    setAuthorized(true);
    setAuthError("");
    pushLog("\u2705 Token accepted");
    await refreshAll();
  }

  // ── Data loading ─────────────────────────────────────────────────────
  async function refreshAll() {
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
      pushLog(`\u274C ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  // ── Client-side filtering ────────────────────────────────────────────
  const filteredItems: MediaItem[] = useMemo(() => {
    let result = allItems;
    if (section !== ALL) {
      result = result.filter((it) => it.section === section);
    }
    if (group !== ALL) {
      result = result.filter((it) => (it.group || "") === group);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter((it) => {
        const hay = [it.PK, it.url, it.title, it.description, it.person, it.section, it.group]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return result;
  }, [allItems, search, section, group]);

  // ── Upload helpers ───────────────────────────────────────────────────
  function onPickUploadFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files || []);
    setUploadFiles(list);
    if (list.length) pushLog(`Selected ${list.length} file(s)`);
  }

  function resolveUploadSection(): string {
    if (uploadSection === "__NEW__") return uploadNewSection.trim();
    return uploadSection;
  }

  function resolveUploadGroup(): string {
    if (uploadGroup === "__NEW__") return uploadNewGroup.trim();
    return uploadGroup;
  }

  async function presignOne(file: File) {
    const t = token.trim();
    const contentType = encodeURIComponent(guessContentType(file));
    const filename = encodeURIComponent(file.name);
    const sec = resolveUploadSection();
    const out = await apiJson(
      `/api/admin/presign?section=${encodeURIComponent(sec)}&filename=${filename}&contentType=${contentType}`,
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
    if (!authorized || !uploadTitle.trim() || !resolveUploadSection() || !uploadFiles.length) {
      pushLog("\u274C Upload requirements not met");
      return;
    }
    const sec = resolveUploadSection();
    const grp = resolveUploadGroup();
    setBusy(true);
    try {
      pushLog(`Uploading ${uploadFiles.length} file(s) to ${sec}${grp ? ` → ${grp}` : ""}...`);
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
          section: sec,
          title: uploadTitle.trim(),
          group: grp || undefined,
          person: uploadPerson.trim() || undefined,
          date: uploadDate.trim() || undefined,
          description: uploadDescription.trim() || undefined,
        });
        pushLog(`\u2705 Uploaded: ${f.name}`);
      }
      clearUpload();
      await refreshAll();
    } catch (e: any) {
      pushLog(`\u274C Upload failed: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function importFromUrl() {
    if (!authorized || !uploadUrl.trim() || !uploadTitle.trim() || !resolveUploadSection()) {
      pushLog("\u274C Import requirements not met");
      return;
    }
    const sec = resolveUploadSection();
    const grp = resolveUploadGroup();
    setBusy(true);
    try {
      pushLog(`Importing from URL: ${uploadUrl.trim().slice(0, 80)}...`);
      const payload: any = {
        url: uploadUrl.trim(),
        section: sec,
        title: uploadTitle.trim(),
      };
      if (grp) payload.group = grp;
      if (uploadPerson.trim()) payload.person = uploadPerson.trim();
      if (uploadDate.trim()) payload.date = uploadDate.trim();
      if (uploadDescription.trim()) payload.description = uploadDescription.trim();
      const out = await apiJson("/api/admin/import-url", {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-token": token },
        body: JSON.stringify(payload),
      });
      if (!out.ok) throw new Error(out.data?.detail || out.data?.error || `Import failed (HTTP ${out.status})`);
      pushLog(`\u2705 Imported: ${out.data?.title || uploadTitle.trim()} (${out.data?.PK})`);
      clearUpload();
      await refreshAll();
    } catch (e: any) {
      pushLog(`\u274C Import failed: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function deleteItem(it: MediaItem) {
    if (!authorized) return;
    if (!confirm(`Delete "${it.title}" (${it.PK})?`)) return;

    setBusy(true);
    try {
      const out = await apiJson(`/api/admin/slides?PK=${encodeURIComponent(it.PK)}`, {
        method: "DELETE",
        headers: { "x-admin-token": token },
      });
      if (!out.ok) throw new Error(out.data?.detail || out.data?.error || "Delete failed");
      pushLog(`\uD83D\uDDD1\uFE0F Deleted: ${it.PK}`);
      await refreshAll();
    } catch (e: any) {
      pushLog(`\u274C ${e?.message ?? String(e)}`);
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
      section: it.section || "",
      group: it.group || "",
    });
    setEditNewSection("");
    setEditNewGroup("");
  }

  function cancelEditing() {
    setEditingPK("");
    setEditingFields({});
    setEditNewSection("");
    setEditNewGroup("");
  }

  function resolveEditSection(): string {
    if (editingFields.section === "__NEW__") return editNewSection.trim();
    return (editingFields.section || "").trim();
  }

  function resolveEditGroup(): string {
    if (editingFields.group === "__NEW__") return editNewGroup.trim();
    return (editingFields.group || "").trim();
  }

  async function saveEditing(it: MediaItem) {
    if (!authorized) return;
    const destSection = resolveEditSection();
    const destGroup = resolveEditGroup();
    if (!destSection) {
      pushLog("\u274C Section is required");
      return;
    }
    setBusy(true);
    try {
      const sectionChanged = destSection !== it.section;
      const groupChanged = destGroup !== (it.group || "");
      const payload: any = {
        PK: it.PK,
        title: editingFields.title,
        description: editingFields.description,
        person: editingFields.person,
        date: editingFields.date,
        section: destSection,
        group: destGroup,
      };
      const out = await apiJson("/api/admin/slides", {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-admin-token": token },
        body: JSON.stringify(payload),
      });
      if (!out.ok) throw new Error(out.data?.detail || out.data?.error || "Update failed");
      if (sectionChanged) {
        pushLog(`\u27A1\uFE0F Moved ${it.PK}: ${it.section} → ${destSection}`);
      } else if (groupChanged) {
        pushLog(`\u27A1\uFE0F Moved ${it.PK}: group ${it.group || "(none)"} → ${destGroup || "(none)"}`);
      } else {
        pushLog(`\u270F\uFE0F Updated: ${it.PK}`);
      }
      setEditingPK("");
      setEditingFields({});
      setEditNewSection("");
      setEditNewGroup("");
      await refreshAll();
      if (sectionChanged || groupChanged) {
        setSection(destSection);
        setTimeout(() => setGroup(destGroup || ALL), 50);
      }
    } catch (e: any) {
      pushLog(`\u274C ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  // ── Delete Handlers ──────────────────────────────────────────────────
  async function handleDeleteSection() {
    if (!targetSection || targetSection === sectionToDelete) {
      pushLog("\u274C Invalid target section");
      return;
    }
    setDeleteBusy(true);
    pushLog(`Starting move & delete of section "${sectionToDelete}" → "${targetSection}"`);
    try {
      const itemsToMove = allItems.filter(i => i.section === sectionToDelete);
      const count = itemsToMove.length;
      if (count === 0) {
        pushLog(`Section "${sectionToDelete}" is already empty → refreshing`);
      } else {
        pushLog(`Moving ${count} items`);
        let success = 0;
        for (const item of itemsToMove) {
          const payload = {
            PK: item.PK,
            section: targetSection,
            group: targetGroup === ALL ? "" : targetGroup,
          };
          const out = await apiJson("/api/admin/slides", {
            method: "PATCH",
            headers: { "content-type": "application/json", "x-admin-token": token },
            body: JSON.stringify(payload),
          });
          if (out.ok) {
            success++;
          } else {
            pushLog(`Failed to move ${item.PK}: ${out.data?.error || out.data?.detail || "Unknown error"}`);
          }
        }
        pushLog(`Moved ${success} of ${count} items`);
      }
      await refreshAll();
      await new Promise(r => setTimeout(r, 600));
      setShowDeleteSectionModal(false);
      setSection(ALL);
      pushLog(`Section delete operation completed`);
    } catch (err: any) {
      pushLog(`Critical error: ${err.message}`);
      alert("Section delete failed: " + err.message);
    } finally {
      setDeleteBusy(false);
    }
  }

  async function handleDeleteGroup() {
    if (!targetSection) {
      pushLog("\u274C No target section selected");
      return;
    }
    setDeleteBusy(true);
    const targetGrp = targetGroup === ALL ? "" : targetGroup;
    pushLog(`Deleting group "${groupToDelete}" in "${sectionToDelete}" → "${targetSection}" / "${targetGrp || '(none)'}"`);
    try {
      const itemsToMove = allItems.filter(
        i => i.section === sectionToDelete && i.group === groupToDelete
      );
      const count = itemsToMove.length;
      if (count === 0) {
        pushLog(`Group "${groupToDelete}" is already empty → refreshing`);
      } else {
        pushLog(`Moving ${count} items`);
        let success = 0;
        for (const item of itemsToMove) {
          const payload = {
            PK: item.PK,
            section: targetSection,
            group: targetGrp,
          };
          const out = await apiJson("/api/admin/slides", {
            method: "PATCH",
            headers: { "content-type": "application/json", "x-admin-token": token },
            body: JSON.stringify(payload),
          });
          if (out.ok) {
            success++;
          } else {
            pushLog(`Failed to move ${item.PK}: ${out.data?.error || out.data?.detail || "Unknown error"}`);
          }
        }
        pushLog(`Moved ${success} of ${count} items`);
      }
      await refreshAll();
      await new Promise(r => setTimeout(r, 600));
      setShowDeleteGroupModal(false);
      setGroup(ALL);
      pushLog(`Group delete operation completed`);
    } catch (err: any) {
      pushLog(`Critical error: ${err.message}`);
      alert("Group delete failed: " + err.message);
    } finally {
      setDeleteBusy(false);
    }
  }

  const filterLabel = section === ALL ? "All Sections" : section;
  const filterGroupLabel = group === ALL ? "All Groups" : group;

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
                setAllItems([]);
                pushLog("Logged out");
              }}
              disabled={busy}
            >
              Log out
            </button>
          </div>
          {authError && <div style={styles.authError}>{"\u26A0\uFE0F"} {authError}</div>}
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
                    onChange={(e) => setSection(e.target.value)}
                    style={styles.filterSelect}
                    disabled={busy || !authorized}
                  >
                    <option value={ALL}>{"\u2014"} All Sections {"\u2014"}</option>
                    {sectionList.map((s) => (
                      <option key={s} value={s}>{s}</option>
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
                    <option value={ALL}>{"\u2014"} All Groups {"\u2014"}</option>
                    {groupOptions.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
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
                  <div style={styles.filterCount}>{filteredItems.length} / {allItems.length} item(s)</div>
                  <div style={styles.filterViewing}>
                    Viewing: <b>{filterLabel}{group !== ALL ? ` → ${filterGroupLabel}` : ""}</b>
                  </div>
                </div>
              </div>

              {/* Delete Controls */}
              <div style={{
                marginTop: 16,
                padding: '12px 16px',
                background: 'rgba(220, 38, 38, 0.05)',
                border: '1px solid rgba(185, 28, 28, 0.20)',
                borderRadius: 14,
                display: 'flex',
                gap: 16,
                flexWrap: 'wrap',
                alignItems: 'center',
              }}>
                {section !== ALL && (
                  <button
                    style={{
                      ...styles.dangerSmall,
                      padding: '10px 18px',
                      fontSize: 15,
                      minWidth: 260,
                    }}
                    onClick={() => {
                      const count = allItems.filter(i => i.section === section).length;
                      if (count === 0) {
                        pushLog(`Section "${section}" is already empty → refreshing`);
                        refreshAll();
                        setSection(ALL);
                      } else {
                        setSectionToDelete(section);
                        setTargetSection("");
                        setTargetGroup(ALL);
                        setShowDeleteSectionModal(true);
                      }
                    }}
                    disabled={busy || deleteBusy}
                  >
                    🗑️ Delete Section "{section}" ({sectionItemCount} items)
                  </button>
                )}

                {group !== ALL && (
                  <button
                    style={{
                      ...styles.dangerSmall,
                      padding: '10px 18px',
                      fontSize: 15,
                      minWidth: 260,
                    }}
                    onClick={() => {
                      const count = allItems.filter(i => i.section === section && i.group === group).length;
                      if (count === 0) {
                        pushLog(`Group "${group}" in "{section}" is already empty → refreshing`);
                        refreshAll();
                        setGroup(ALL);
                      } else {
                        setSectionToDelete(section);
                        setGroupToDelete(group);
                        setTargetSection("");
                        setTargetGroup(ALL);
                        setShowDeleteGroupModal(true);
                      }
                    }}
                    disabled={busy || deleteBusy}
                  >
                    🗑️ Delete Group "{group}" ({groupItemCount} items)
                  </button>
                )}

                {section === ALL && group === ALL && (
                  <span style={{ fontSize: 13, opacity: 0.7, fontStyle: 'italic' }}>
                    Select a specific section or group to enable delete options
                  </span>
                )}
              </div>
            </section>

            {/* ── Upload Section ──────────────────────────────────────── */}
            <section style={styles.uploadCard}>
              <div style={styles.cardHeader}>
                <div>
                  <div style={styles.cardTitle}>Add media</div>
                  <div style={styles.cardHint}>Upload a file or import from a URL (X, YouTube, etc.)</div>
                </div>
              </div>

              <div style={styles.tabRow}>
                <button
                  style={uploadMode === "file" ? styles.tabActive : styles.tab}
                  onClick={() => setUploadMode("file")}
                  disabled={busy}
                >
                  {"\uD83D\uDCC1"} File Upload
                </button>
                <button
                  style={uploadMode === "url" ? styles.tabActive : styles.tab}
                  onClick={() => setUploadMode("url")}
                  disabled={busy}
                >
                  {"\uD83D\uDD17"} Import from URL
                </button>
              </div>

              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 10 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={styles.label}>Section (required)</label>
                  <select
                    value={uploadSection}
                    onChange={(e) => {
                      setUploadSection(e.target.value);
                      setUploadGroup("");
                      setUploadNewSection("");
                    }}
                    style={styles.filterSelect}
                    disabled={busy || !authorized}
                  >
                    <option value="">-- Select --</option>
                    {sectionList.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                    <option value="__NEW__">{"\u2795"} Add New Section...</option>
                  </select>
                  {uploadSection === "__NEW__" && (
                    <input
                      value={uploadNewSection}
                      onChange={(e) => setUploadNewSection(e.target.value)}
                      placeholder="New section name"
                      style={{ ...styles.input, marginTop: 8, border: "2px solid rgba(34,197,94,0.5)" }}
                      autoFocus
                      disabled={busy}
                    />
                  )}
                </div>

                {/* ── Group field with Create button ── */}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={styles.label}>Group (optional)</label>
                  <select
                    value={uploadGroup}
                    onChange={(e) => {
                      setUploadGroup(e.target.value);
                      setUploadNewGroup("");
                    }}
                    style={styles.filterSelect}
                    disabled={busy || !authorized || !uploadSection || uploadSection === "__NEW__"}
                  >
                    <option value="">(none)</option>
                    {(uploadSection && sectionMap[uploadSection] || []).map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                    <option value="__NEW__">{"\u2795"} Add New Group...</option>
                  </select>

                  {uploadGroup === "__NEW__" && (
                    <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        value={uploadNewGroup}
                        onChange={(e) => setUploadNewGroup(e.target.value)}
                        placeholder="New group name"
                        style={{ ...styles.input, flex: 1, border: "2px solid rgba(34,197,94,0.5)" }}
                        autoFocus
                        disabled={busy}
                      />
                      <button
                        style={{
                          padding: "8px 12px",
                          background: "#15803d",
                          color: "white",
                          border: "none",
                          borderRadius: 8,
                          cursor: "pointer",
                          fontWeight: 800,
                          fontSize: 13,
                        }}
                        onClick={async () => {
                          if (!uploadNewGroup.trim()) {
                            pushLog("\u274C Please enter a group name");
                            return;
                          }

                          if (!uploadSection || uploadSection === "__NEW__") {
                            pushLog("\u274C Select a section first");
                            return;
                          }

                          setBusy(true);
                          try {
                            const finalSection = resolveUploadSection();
                            const payload = {
                              section: finalSection,
                              group: uploadNewGroup.trim(),
                            };

                            const res = await fetch("/api/admin/create-group", {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                "x-admin-token": token,
                              },
                              body: JSON.stringify(payload),
                            });

                            const data = await res.json();

                            if (res.ok && data.success) {
                              pushLog(`\u2705 Group "${uploadNewGroup.trim()}" created in "${finalSection}"`);
                              setUploadNewGroup("");
                              setUploadGroup(uploadNewGroup.trim()); // auto-select
                              await refreshAll();
                              await new Promise(r => setTimeout(r, 800));
                              await refreshAll(); // double refresh to be sure
                            } else {
                              pushLog(`\u274C Failed: ${data.error || "Unknown error"}`);
                            }
                          } catch (err: any) {
                            pushLog(`\u274C Error creating group: ${err.message}`);
                          } finally {
                            setBusy(false);
                          }
                        }}
                        disabled={busy || !uploadNewGroup.trim()}
                      >
                        Create Group
                      </button>
                    </div>
                  )}
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

              {uploadMode === "file" ? (
                <>
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
                    {uploadFiles.length > 0 && (
                      <div style={styles.miniNote}>Selected: {uploadFiles.length}</div>
                    )}
                  </div>
                  <button
                    style={styles.bigButton}
                    onClick={uploadMedia}
                    disabled={!authorized || busy || !uploadTitle.trim() || !uploadFiles.length}
                  >
                    {busy ? "Working..." : "Upload"}
                  </button>
                </>
              ) : (
                <>
                  <div style={styles.fieldBlock}>
                    <label style={styles.label}>Source URL (X, YouTube, etc.)</label>
                    <input
                      value={uploadUrl}
                      onChange={(e) => setUploadUrl(e.target.value)}
                      placeholder="https://x.com/user/status/123456789"
                      style={{ ...styles.input, border: "2px solid rgba(139, 92, 246, 0.4)" }}
                      disabled={busy || !authorized}
                    />
                    <div style={styles.miniNote}>
                      Supported: X/Twitter, YouTube, Instagram, and 1000+ sites via yt-dlp
                    </div>
                  </div>
                  <button
                    style={styles.bigButtonPurple}
                    onClick={importFromUrl}
                    disabled={!authorized || busy || !uploadTitle.trim() || !uploadUrl.trim()}
                  >
                    {busy ? "Downloading & importing..." : "\uD83D\uDD17 Import from URL"}
                  </button>
                </>
              )}
            </section>

            {/* ── Items List ──────────────────────────────────────────── */}
            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <div style={styles.cardTitle}>
                    Items {section !== ALL ? `in ${section}` : ""}{" "}
                    {group !== ALL ? `→ ${group}` : ""}
                  </div>
                  <div style={styles.cardHint}>
                    Edit details, move between sections, or delete items below.
                  </div>
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
                            <button
                              style={styles.saveButton}
                              onClick={() => saveEditing(it)}
                              disabled={busy}
                            >
                              Save
                            </button>
                            <button
                              style={styles.cancelButton}
                              onClick={cancelEditing}
                              disabled={busy}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              style={styles.editButton}
                              onClick={() => startEditing(it)}
                              disabled={busy}
                            >
                              Edit
                            </button>
                            <button
                              style={styles.dangerSmall}
                              onClick={() => deleteItem(it)}
                              disabled={busy}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div style={styles.itemMeta}>
                      {editingPK === it.PK ? (
                        <>
                          <div style={styles.moveBox}>
                            <div style={styles.moveBoxTitle}>{"\u27A1\uFE0F"} Section / Group</div>
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                              <div style={{ flex: 1, minWidth: 200 }}>
                                <label style={styles.label}>Section</label>
                                <select
                                  value={editingFields.section || ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditNewSection("");
                                    setEditNewGroup("");
                                    if (val === "__NEW__") {
                                      setEditingFields({ ...editingFields, section: "__NEW__", group: "" });
                                    } else {
                                      const newGroups = sectionMap[val] || [];
                                      setEditingFields({
                                        ...editingFields,
                                        section: val,
                                        group: newGroups[0] || "",
                                      });
                                    }
                                  }}
                                  style={styles.editSelect}
                                >
                                  {sectionList.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                  ))}
                                  <option value="__NEW__">{"\u2795"} Add New Section...</option>
                                </select>
                                {editingFields.section === "__NEW__" && (
                                  <input
                                    value={editNewSection}
                                    onChange={(e) => setEditNewSection(e.target.value)}
                                    placeholder="New section name"
                                    style={{ ...styles.input, marginTop: 8, border: "2px solid rgba(34,197,94,0.5)" }}
                                    autoFocus
                                  />
                                )}
                              </div>
                              <div style={{ flex: 1, minWidth: 200 }}>
                                <label style={styles.label}>Group</label>
                                <select
                                  value={editingFields.group || ""}
                                  onChange={(e) => {
                                    setEditNewGroup("");
                                    setEditingFields({ ...editingFields, group: e.target.value });
                                  }}
                                  style={styles.editSelect}
                                  disabled={editingFields.section === "__NEW__"}
                                >
                                  <option value="">(none)</option>
                                  {(editingFields.section && sectionMap[editingFields.section] || []).map((g) => (
                                    <option key={g} value={g}>{g}</option>
                                  ))}
                                  <option value="__NEW__">{"\u2795"} Add New Group...</option>
                                </select>
                                {editingFields.group === "__NEW__" && (
                                  <input
                                    value={editNewGroup}
                                    onChange={(e) => setEditNewGroup(e.target.value)}
                                    placeholder="New group name"
                                    style={{ ...styles.input, marginTop: 8, border: "2px solid rgba(34,197,94,0.5)" }}
                                    autoFocus
                                  />
                                )}
                              </div>
                            </div>
                          </div>

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
                          <div style={styles.itemLine}>
                            <span style={styles.dim}>Section:</span> {it.section}
                          </div>
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
                    {allItems.length === 0
                      ? "No items uploaded yet."
                      : `No items match the current filter (${filterLabel}${
                          group !== ALL ? ` → ${filterGroupLabel}` : ""
                        }).`}
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

        {/* Delete Section Modal */}
        {showDeleteSectionModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                background: "white",
                padding: 24,
                borderRadius: 16,
                maxWidth: 480,
                width: "90%",
                boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
              }}
            >
              <h3 style={{ margin: "0 0 16px", color: "#991b1b" }}>
                Delete Section: {sectionToDelete}
              </h3>

              <p>
                {sectionItemCount > 0 ? (
                  <>This section contains <strong>{sectionItemCount}</strong> items.</>
                ) : (
                  <>This section is empty and will disappear after refresh.</>
                )}
              </p>

              {sectionItemCount > 0 && (
                <p style={{ margin: "16px 0" }}>
                  You must move these items to another section before deletion.
                </p>
              )}

              {sectionItemCount > 0 && (
                <div style={{ margin: "16px 0" }}>
                  <label style={{ fontWeight: 800, display: "block", marginBottom: 8 }}>
                    Move to section:
                  </label>
                  <select
                    value={targetSection}
                    onChange={(e) => {
                      setTargetSection(e.target.value);
                      setTargetGroup(ALL);
                    }}
                    style={styles.editSelect}
                  >
                    <option value="">— Select target section —</option>
                    {sectionList
                      .filter((s) => s !== sectionToDelete)
                      .map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {sectionItemCount > 0 && targetSection && sectionMap[targetSection]?.length > 0 && (
                <div style={{ margin: "16px 0" }}>
                  <label style={{ fontWeight: 800, display: "block", marginBottom: 8 }}>
                    Move to group (optional):
                  </label>
                  <select
                    value={targetGroup}
                    onChange={(e) => setTargetGroup(e.target.value)}
                    style={styles.editSelect}
                  >
                    <option value={ALL}>No specific group (root of section)</option>
                    {sectionMap[targetSection].map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button
                  style={styles.cancelButton}
                  onClick={() => {
                    setShowDeleteSectionModal(false);
                    setSectionToDelete("");
                    setTargetSection("");
                    setTargetGroup(ALL);
                  }}
                >
                  Cancel
                </button>

                {sectionItemCount > 0 && (
                  <button
                    style={{
                      ...styles.dangerSmall,
                      opacity: deleteBusy || !targetSection ? 0.6 : 1,
                    }}
                    disabled={deleteBusy || !targetSection}
                    onClick={handleDeleteSection}
                  >
                    {deleteBusy ? "Moving & Deleting..." : "Move & Delete Section"}
                  </button>
                )}

                {sectionItemCount === 0 && (
                  <button
                    style={styles.buttonPrimary}
                    onClick={() => {
                      refreshAll();
                      setShowDeleteSectionModal(false);
                      setSection(ALL);
                    }}
                  >
                    Refresh & Close
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Delete Group Modal */}
        {showDeleteGroupModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                background: "white",
                padding: 24,
                borderRadius: 16,
                maxWidth: 480,
                width: "90%",
                boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
              }}
            >
              <h3 style={{ margin: "0 0 16px", color: "#991b1b" }}>
                Delete Group: {groupToDelete} (in {sectionToDelete})
              </h3>

              <p>
                {groupItemCount > 0 ? (
                  <>This group contains <strong>{groupItemCount}</strong> items.</>
                ) : (
                  <>This group is empty and will disappear after refresh.</>
                )}
              </p>

              {groupItemCount > 0 && (
                <p style={{ margin: "16px 0" }}>
                  Move these items to another group in the same section or to another section.
                </p>
              )}

              {groupItemCount > 0 && (
                <div style={{ margin: "16px 0" }}>
                  <label style={{ fontWeight: 800, display: "block", marginBottom: 8 }}>
                    Move to section:
                  </label>
                  <select
                    value={targetSection}
                    onChange={(e) => {
                      setTargetSection(e.target.value);
                      setTargetGroup(ALL);
                    }}
                    style={styles.editSelect}
                  >
                    <option value="">— Select target section —</option>
                    {sectionList.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {groupItemCount > 0 && targetSection && sectionMap[targetSection]?.length > 0 && (
                <div style={{ margin: "16px 0" }}>
                  <label style={{ fontWeight: 800, display: "block", marginBottom: 8 }}>
                    Move to group (optional):
                  </label>
                  <select
                    value={targetGroup}
                    onChange={(e) => setTargetGroup(e.target.value)}
                    style={styles.editSelect}
                  >
                    <option value={ALL}>No specific group (root of section)</option>
                    {sectionMap[targetSection]
                      .filter((g) => targetSection !== sectionToDelete || g !== groupToDelete)
                      .map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button
                  style={styles.cancelButton}
                  onClick={() => {
                    setShowDeleteGroupModal(false);
                    setSectionToDelete("");
                    setGroupToDelete("");
                    setTargetSection("");
                    setTargetGroup(ALL);
                  }}
                >
                  Cancel
                </button>

                {groupItemCount > 0 && (
                  <button
                    style={{
                      ...styles.dangerSmall,
                      opacity: deleteBusy || !targetSection ? 0.6 : 1,
                    }}
                    disabled={deleteBusy || !targetSection}
                    onClick={handleDeleteGroup}
                  >
                    {deleteBusy ? "Moving & Deleting..." : "Move & Delete Group"}
                  </button>
                )}

                {groupItemCount === 0 && (
                  <button
                    style={styles.buttonPrimary}
                    onClick={() => {
                      refreshAll();
                      setShowDeleteGroupModal(false);
                      setGroup(ALL);
                    }}
                  >
                    Refresh & Close
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────
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
  bigButtonPurple: {
    marginTop: 12,
    width: "100%",
    padding: "14px",
    borderRadius: 16,
    border: "1px solid rgba(139, 92, 246, 0.3)",
    background: "#7c3aed",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
    fontSize: 16,
  },
  tabRow: {
    display: "flex",
    gap: 6,
    marginBottom: 14,
    borderBottom: "2px solid rgba(15, 23, 42, 0.08)",
    paddingBottom: 10,
  },
  tab: {
    padding: "10px 18px",
    borderRadius: 12,
    border: "1px solid rgba(15, 23, 42, 0.10)",
    background: "transparent",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 14,
    opacity: 0.6,
  },
  tabActive: {
    padding: "10px 18px",
    borderRadius: 12,
    border: "2px solid #0f172a",
    background: "rgba(15, 23, 42, 0.06)",
    cursor: "pointer",
    fontWeight: 950,
    fontSize: 14,
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
  moveBox: {
    padding: 12,
    borderRadius: 14,
    border: "2px solid rgba(59, 130, 246, 0.30)",
    background: "rgba(59, 130, 246, 0.06)",
    marginBottom: 4,
  },
  moveBoxTitle: {
    fontWeight: 950,
    fontSize: 13,
    marginBottom: 10,
    color: "#1e40af",
  },
  editSelect: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "2px solid rgba(59, 130, 246, 0.35)",
    background: "white",
    fontWeight: 800,
    fontSize: 14,
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