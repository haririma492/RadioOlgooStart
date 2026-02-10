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
  const [editFile, setEditFile] = useState<File | null>(null);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDeleteSectionModal, setShowDeleteSectionModal] = useState(false);
  const [showDeleteGroupModal, setShowDeleteGroupModal] = useState(false);
  const [sectionToDelete, setSectionToDelete] = useState<string>("");
  const [groupToDelete, setGroupToDelete] = useState<string>("");
  const [targetSection, setTargetSection] = useState<string>("");
  const [targetGroup, setTargetGroup] = useState<string>(ALL);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [logCollapsed, setLogCollapsed] = useState(false);

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

  // Profile pictures for person dropdown (when section is "Youtube Chanel Videos")
  const profilePictures = useMemo(() => {
    return allItems.filter(item => item.section === "Youtube_Channel_Profile_Picture" && item.person);
  }, [allItems]);

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
    setShowUploadModal(false);
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

  async function presignOne(file: File, section?: string) {
    const t = token.trim();
    const contentType = encodeURIComponent(guessContentType(file));
    const filename = encodeURIComponent(file.name);
    const sec = section || resolveUploadSection();
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
    // Validate person is required for "Youtube Chanel Videos"
    if (sec === "Youtube Chanel Videos" && !uploadPerson.trim()) {
      pushLog("\u274C Person is required for Youtube Chanel Videos section");
      return;
    }
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
    // Validate person is required for "Youtube Chanel Videos"
    if (sec === "Youtube Chanel Videos" && !uploadPerson.trim()) {
      pushLog("\u274C Person is required for Youtube Chanel Videos section");
      return;
    }
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
    setEditFile(null);
    if (editFileInputRef.current) editFileInputRef.current.value = "";
  }

  function cancelEditing() {
    setEditingPK("");
    setEditingFields({});
    setEditNewSection("");
    setEditNewGroup("");
    setEditFile(null);
    if (editFileInputRef.current) editFileInputRef.current.value = "";
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
    // Validate person is required for "Youtube Chanel Videos"
    if (destSection === "Youtube Chanel Videos" && !editingFields.person?.trim()) {
      pushLog("\u274C Person is required for Youtube Chanel Videos section");
      return;
    }
    setBusy(true);
    try {
      const sectionChanged = destSection !== it.section;
      const groupChanged = destGroup !== (it.group || "");
      
      let newUrl = it.url; // Keep existing URL by default
      
      // If a new file is selected, upload it first
      if (editFile) {
        pushLog(`Uploading new image for ${it.PK}...`);
        const pres = await presignOne(editFile, destSection);
        const contentType = guessContentType(editFile);
        const putRes = await fetch(pres.uploadUrl, {
          method: "PUT",
          headers: { "content-type": contentType },
          body: editFile,
        });
        if (!putRes.ok) throw new Error(`S3 upload failed (HTTP ${putRes.status}) ${editFile.name}`);
        newUrl = pres.publicUrl;
        pushLog(`\u2705 New image uploaded`);
      }
      
      const payload: any = {
        PK: it.PK,
        title: editingFields.title,
        description: editingFields.description,
        person: editingFields.person,
        date: editingFields.date,
        section: destSection,
        group: destGroup,
        url: newUrl, // Include URL (either existing or new)
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
      setEditFile(null);
      if (editFileInputRef.current) editFileInputRef.current.value = "";
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

  // Auto-scroll log to bottom
  const logRef = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log]);

  // Handle Escape key to close modals
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showUploadModal) setShowUploadModal(false);
        if (showDeleteSectionModal) setShowDeleteSectionModal(false);
        if (showDeleteGroupModal) setShowDeleteGroupModal(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [showUploadModal, showDeleteSectionModal, showDeleteGroupModal]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 text-slate-900 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Radio Olgoo Admin
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                authorized
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-red-50 text-red-700 border-red-200"
              }`}
            >
              {authorized ? "✓ Authorized" : "🔒 Locked"}
            </span>
            <button
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-xs transition-colors shadow-sm"
              onClick={refreshAll}
              disabled={!authorized || busy}
            >
              ↻ Refresh
            </button>
            {authorized && (
              <button
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm transition-colors shadow-lg"
                onClick={() => setShowUploadModal(true)}
                disabled={busy}
              >
                ➕ Add Media
              </button>
            )}
          </div>
        </header>

        {/* Token Section */}
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
          {authError && (
            <div className="mt-4 px-4 py-3 rounded-xl border border-red-300 bg-red-50 text-red-700 font-bold text-sm">
              ⚠️ {authError}
            </div>
          )}
        </section>

        {/* Gated Content */}
        <div className="relative">
          <div
            className={`transition-all duration-200 ${
              authorized ? "opacity-100" : "opacity-40 blur-sm pointer-events-none"
            }`}
          >
            {/* Compact Filter Bar */}
            <section className="sticky top-0 z-20 mb-3 bg-white/95 backdrop-blur-md rounded-lg border border-slate-200 shadow-sm p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={busy || !authorized}
                >
                  <option value={ALL}>All Sections</option>
                  {sectionList.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <select
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={busy || !authorized}
                >
                  <option value={ALL}>All Groups</option>
                  {groupOptions.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
                <div className="relative flex-1 min-w-[150px] max-w-[250px]">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search..."
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={busy || !authorized}
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                      aria-label="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {(section !== ALL || group !== ALL || search) && (
                  <button
                    onClick={() => {
                      setSection(ALL);
                      setGroup(ALL);
                      setSearch("");
                    }}
                    className="px-2 py-1 rounded text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                  >
                    Clear
                  </button>
                )}
                <div className="ml-auto flex items-center">
                  <span className="px-2 py-1 rounded bg-slate-100 text-xs font-bold text-slate-700">
                    {filteredItems.length}/{allItems.length}
                  </span>
                </div>
              </div>

            </section>

            {/* ── Items List ──────────────────────────────────────────── */}
            <section className="mb-4">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-base font-black text-slate-900">
                  {filteredItems.length} Item{filteredItems.length !== 1 ? 's' : ''} {section !== ALL ? `in ${section}` : ""}{" "}
                  {group !== ALL ? `→ ${group}` : ""}
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredItems.map((it) => (
                  <div
                    key={it.PK}
                    className={`group border border-slate-200 rounded-lg bg-white shadow-sm hover:shadow-lg transition-all overflow-hidden ${
                      editingPK === it.PK ? "md:col-span-2 lg:col-span-3" : ""
                    }`}
                  >
                    {/* Thumbnail Preview */}
                    <div className="relative aspect-video bg-slate-100 overflow-hidden">
                      {isVideo(it.url) ? (
                        <video
                          src={it.url}
                          className="w-full h-full object-cover"
                          preload="metadata"
                          muted
                        />
                      ) : isImage(it.url) ? (
                        <img
                          src={it.url}
                          alt={it.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-200">
                          <span className="text-slate-400 text-2xl">📄</span>
                        </div>
                      )}
                      {/* Action Buttons Overlay */}
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {editingPK === it.PK ? (
                          <>
                            <button
                              className="p-1.5 rounded bg-green-500 text-white hover:bg-green-600 shadow-lg"
                              onClick={() => saveEditing(it)}
                              disabled={busy}
                              title="Save"
                            >
                              ✓
                            </button>
                            <button
                              className="p-1.5 rounded bg-slate-500 text-white hover:bg-slate-600 shadow-lg"
                              onClick={cancelEditing}
                              disabled={busy}
                              title="Cancel"
                            >
                              ✕
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="p-1.5 rounded bg-blue-500 text-white hover:bg-blue-600 shadow-lg"
                              onClick={() => startEditing(it)}
                              disabled={busy}
                              title="Edit"
                            >
                              ✏️
                            </button>
                            <button
                              className="p-1.5 rounded bg-red-500 text-white hover:bg-red-600 shadow-lg"
                              onClick={() => deleteItem(it)}
                              disabled={busy}
                              title="Delete"
                            >
                              🗑️
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Card Content */}
                    {editingPK !== it.PK ? (
                      <div className="p-3">
                        <div className="text-xs text-slate-500 font-bold mb-1 truncate">{it.PK}</div>
                        <h3 className="text-sm font-black text-slate-900 mb-2 line-clamp-2 min-h-[2.5rem]">{it.title}</h3>
                        <div className="space-y-1 text-xs text-slate-600">
                          {it.section && (
                            <div className="truncate"><span className="font-semibold">Section:</span> {it.section}</div>
                          )}
                          {it.group && (
                            <div className="truncate"><span className="font-semibold">Group:</span> {it.group}</div>
                          )}
                          {it.person && (
                            <div className="truncate"><span className="font-semibold">Person:</span> {it.person}</div>
                          )}
                        </div>
                        <a
                          href={it.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block text-xs text-blue-600 hover:text-blue-700 font-semibold"
                          onClick={(e) => e.stopPropagation()}
                        >
                          🔗 Open
                        </a>
                      </div>
                    ) : (
                      <div className="p-4 border-t border-slate-200 bg-slate-50">
                        <div className="space-y-3">
                          <div className="p-4 rounded-xl border-2 border-blue-300 bg-blue-50">
                            <div className="text-sm font-black text-blue-900 mb-3">➡️ Section / Group</div>
                            <div className="flex flex-col sm:flex-row gap-4">
                              <div className="flex-1 min-w-[200px]">
                                <label className="block text-xs font-bold text-slate-700 mb-2">Section</label>
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
                                  className="w-full px-4 py-2.5 rounded-lg border-2 border-blue-400 bg-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                >
                                  {sectionList.map((s) => (
                                    <option key={s} value={s}>
                                      {s}
                                    </option>
                                  ))}
                                  <option value="__NEW__">➕ Add New Section...</option>
                                </select>
                                {editingFields.section === "__NEW__" && (
                                  <input
                                    value={editNewSection}
                                    onChange={(e) => setEditNewSection(e.target.value)}
                                    placeholder="New section name"
                                    className="w-full mt-2 px-4 py-2.5 rounded-lg border-2 border-green-400 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm font-medium"
                                    autoFocus
                                  />
                                )}
                              </div>
                              <div className="flex-1 min-w-[200px]">
                                <label className="block text-xs font-bold text-slate-700 mb-2">Group</label>
                                <select
                                  value={editingFields.group || ""}
                                  onChange={(e) => {
                                    setEditNewGroup("");
                                    setEditingFields({ ...editingFields, group: e.target.value });
                                  }}
                                  className="w-full px-4 py-2.5 rounded-lg border-2 border-blue-400 bg-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                  disabled={editingFields.section === "__NEW__"}
                                >
                                  <option value="">(none)</option>
                                  {(editingFields.section && sectionMap[editingFields.section] || []).map((g) => (
                                    <option key={g} value={g}>
                                      {g}
                                    </option>
                                  ))}
                                  <option value="__NEW__">➕ Add New Group...</option>
                                </select>
                                {editingFields.group === "__NEW__" && (
                                  <input
                                    value={editNewGroup}
                                    onChange={(e) => setEditNewGroup(e.target.value)}
                                    placeholder="New group name"
                                    className="w-full mt-2 px-4 py-2.5 rounded-lg border-2 border-green-400 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm font-medium"
                                    autoFocus
                                  />
                                )}
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-2">Title</label>
                            <input
                              value={editingFields.title || ""}
                              onChange={(e) => setEditingFields({ ...editingFields, title: e.target.value })}
                              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-2">
                              Person {resolveEditSection() === "Youtube Chanel Videos" ? <span className="text-red-500">*</span> : "(optional)"}
                            </label>
                            {resolveEditSection() === "Youtube Chanel Videos" ? (
                              <select
                                value={editingFields.person || ""}
                                onChange={(e) => setEditingFields({ ...editingFields, person: e.target.value })}
                                className={`w-full px-4 py-2.5 rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                                  editingFields.person ? "border-slate-300" : "border-red-400"
                                }`}
                                disabled={busy}
                              >
                                <option value="">-- Select Person --</option>
                                {profilePictures.map((profile) => (
                                  <option key={profile.PK} value={profile.person || ""}>
                                    {profile.person || "Unknown"}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                value={editingFields.person || ""}
                                onChange={(e) => setEditingFields({ ...editingFields, person: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={busy}
                              />
                            )}
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-2">Date</label>
                            <input
                              type="date"
                              value={editingFields.date || ""}
                              onChange={(e) => setEditingFields({ ...editingFields, date: e.target.value })}
                              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-2">Description</label>
                            <textarea
                              value={editingFields.description || ""}
                              onChange={(e) => setEditingFields({ ...editingFields, description: e.target.value })}
                              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm min-h-[80px] resize-y"
                            />
                          </div>

                          {/* Image Upload for Profile Pictures */}
                          {resolveEditSection() === "Youtube_Channel_Profile_Picture" && (
                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-2">Replace Image (optional)</label>
                              <input
                                ref={editFileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0] || null;
                                  setEditFile(file);
                                  if (file) pushLog(`Selected: ${file.name}`);
                                }}
                                disabled={busy}
                                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                              />
                              {editFile && (
                                <div className="mt-2 text-xs text-slate-600 font-bold">
                                  New file: {editFile.name} ({(editFile.size / 1024).toFixed(1)} KB)
                                </div>
                              )}
                              {!editFile && it.url && (
                                <div className="mt-2 text-xs text-slate-600 font-bold">
                                  Current: <a href={it.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">View current image</a>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {!filteredItems.length && (
                  <div className="opacity-70 font-bold p-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-center text-sm text-slate-600">
                    {allItems.length === 0
                      ? "No items uploaded yet."
                      : `No items match the current filter (${filterLabel}${
                          group !== ALL ? ` → ${filterGroupLabel}` : ""
                        }).`}
                  </div>
                )}
              </div>
            </section>

            {/* Log - Collapsible */}
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
          </div>

          {!authorized && (
            <div className="absolute inset-0 flex items-start justify-center pt-20 pointer-events-none">
              <div className="w-full max-w-lg mx-4 rounded-2xl border border-slate-300 bg-white/80 backdrop-blur-md shadow-2xl p-6 text-center">
                <div className="font-black text-lg text-slate-900 mb-2">🔒 Locked</div>
                <div className="text-sm text-slate-600 font-semibold">
                  Enter a valid admin token above to unlock this screen.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Upload Modal */}
        {showUploadModal && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowUploadModal(false)}
          >
            <div
              className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-slate-900">Add Media</h2>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 mb-6 border-b-2 border-slate-200 pb-3">
                <button
                  className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                    uploadMode === "file"
                      ? "bg-slate-900 text-white"
                      : "bg-transparent text-slate-600 hover:bg-slate-50"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  onClick={() => setUploadMode("file")}
                  disabled={busy}
                >
                  📁 File Upload
                </button>
                <button
                  className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                    uploadMode === "url"
                      ? "bg-slate-900 text-white"
                      : "bg-transparent text-slate-600 hover:bg-slate-50"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  onClick={() => setUploadMode("url")}
                  disabled={busy}
                >
                  🔗 Import from URL
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      Section <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={uploadSection}
                      onChange={(e) => {
                        setUploadSection(e.target.value);
                        setUploadGroup("");
                        setUploadNewSection("");
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={busy || !authorized}
                    >
                      <option value="">-- Select --</option>
                      {sectionList.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                      <option value="__NEW__">➕ Add New Section...</option>
                    </select>
                    {uploadSection === "__NEW__" && (
                      <input
                        value={uploadNewSection}
                        onChange={(e) => setUploadNewSection(e.target.value)}
                        placeholder="New section name"
                        className="w-full mt-2 px-3 py-2 rounded-lg border-2 border-green-400 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm font-medium"
                        autoFocus
                        disabled={busy}
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">Group (optional)</label>
                    <select
                      value={uploadGroup}
                      onChange={(e) => {
                        setUploadGroup(e.target.value);
                        setUploadNewGroup("");
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={busy || !authorized || !uploadSection || uploadSection === "__NEW__"}
                    >
                      <option value="">(none)</option>
                      {(uploadSection && sectionMap[uploadSection] || []).map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                      <option value="__NEW__">➕ Add New Group...</option>
                    </select>
                    {uploadGroup === "__NEW__" && (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          value={uploadNewGroup}
                          onChange={(e) => setUploadNewGroup(e.target.value)}
                          placeholder="New group name"
                          className="flex-1 px-3 py-2 rounded-lg border-2 border-green-400 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm font-medium"
                          autoFocus
                          disabled={busy}
                        />
                        <button
                          className="px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 active:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-xs transition-colors"
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
                                setUploadGroup(uploadNewGroup.trim());
                                await refreshAll();
                                await new Promise(r => setTimeout(r, 800));
                                await refreshAll();
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
                          Create
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      placeholder="Enter title"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={busy || !authorized}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      Person {resolveUploadSection() === "Youtube Chanel Videos" ? <span className="text-red-500">*</span> : "(optional)"}
                    </label>
                    {resolveUploadSection() === "Youtube Chanel Videos" ? (
                      <select
                        value={uploadPerson}
                        onChange={(e) => setUploadPerson(e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                          uploadPerson.trim() ? "border-slate-300" : "border-red-400"
                        }`}
                        disabled={busy || !authorized}
                      >
                        <option value="">-- Select Person --</option>
                        {profilePictures.map((profile) => (
                          <option key={profile.PK} value={profile.person || ""}>
                            {profile.person || "Unknown"}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={uploadPerson}
                        onChange={(e) => setUploadPerson(e.target.value)}
                        placeholder="Speaker/Artist name"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={busy || !authorized}
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">Date (optional)</label>
                    <input
                      type="date"
                      value={uploadDate}
                      onChange={(e) => setUploadDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={busy || !authorized}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Description (optional)</label>
                  <textarea
                    value={uploadDescription}
                    onChange={(e) => setUploadDescription(e.target.value)}
                    placeholder="Brief description"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm min-h-[80px] resize-y disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={busy || !authorized}
                  />
                </div>

                {uploadMode === "file" ? (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">Choose file(s)</label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="video/*,image/*"
                        onChange={onPickUploadFiles}
                        disabled={busy || !authorized}
                        className="w-full px-3 py-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                      {uploadFiles.length > 0 && (
                        <div className="mt-2 text-xs text-slate-600 font-bold">
                          ✓ Selected: {uploadFiles.length} file(s)
                        </div>
                      )}
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button
                        className="flex-1 px-4 py-3 rounded-lg bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 disabled:opacity-50 disabled:cursor-not-allowed font-black text-sm transition-colors shadow-lg"
                        onClick={uploadMedia}
                        disabled={
                          !authorized || 
                          busy || 
                          !uploadTitle.trim() || 
                          !uploadFiles.length ||
                          (resolveUploadSection() === "Youtube Chanel Videos" && !uploadPerson.trim())
                        }
                      >
                        {busy ? "⏳ Working..." : "⬆️ Upload"}
                      </button>
                      <button
                        className="px-4 py-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 font-bold text-sm transition-colors"
                        onClick={() => setShowUploadModal(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">Source URL (X, YouTube, etc.)</label>
                      <input
                        value={uploadUrl}
                        onChange={(e) => setUploadUrl(e.target.value)}
                        placeholder="https://x.com/user/status/123456789"
                        className="w-full px-3 py-2 rounded-lg border-2 border-purple-300 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={busy || !authorized}
                      />
                      <div className="mt-2 text-xs text-slate-600 font-bold">
                        Supported: X/Twitter, YouTube, Instagram, and 1000+ sites via yt-dlp
                      </div>
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button
                        className="flex-1 px-4 py-3 rounded-lg bg-purple-600 text-white hover:bg-purple-700 active:bg-purple-800 disabled:opacity-50 disabled:cursor-not-allowed font-black text-sm transition-colors shadow-lg"
                        onClick={importFromUrl}
                        disabled={
                          !authorized || 
                          busy || 
                          !uploadTitle.trim() || 
                          !uploadUrl.trim() ||
                          (resolveUploadSection() === "Youtube Chanel Videos" && !uploadPerson.trim())
                        }
                      >
                        {busy ? "⏳ Downloading & importing..." : "🔗 Import from URL"}
                      </button>
                      <button
                        className="px-4 py-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 font-bold text-sm transition-colors"
                        onClick={() => setShowUploadModal(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Delete Section Modal */}
        {showDeleteSectionModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <h3 className="text-xl font-black text-red-700 mb-4">
                Delete Section: {sectionToDelete}
              </h3>

              <p className="text-sm text-slate-700 mb-4">
                {sectionItemCount > 0 ? (
                  <>This section contains <strong className="font-black">{sectionItemCount}</strong> items.</>
                ) : (
                  <>This section is empty and will disappear after refresh.</>
                )}
              </p>

              {sectionItemCount > 0 && (
                <p className="text-sm text-slate-600 mb-4">
                  You must move these items to another section before deletion.
                </p>
              )}

              {sectionItemCount > 0 && (
                <div className="mb-4">
                  <label className="block font-black text-sm text-slate-700 mb-2">
                    Move to section:
                  </label>
                  <select
                    value={targetSection}
                    onChange={(e) => {
                      setTargetSection(e.target.value);
                      setTargetGroup(ALL);
                    }}
                    className="w-full px-4 py-2.5 rounded-lg border-2 border-blue-400 bg-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                <div className="mb-4">
                  <label className="block font-black text-sm text-slate-700 mb-2">
                    Move to group (optional):
                  </label>
                  <select
                    value={targetGroup}
                    onChange={(e) => setTargetGroup(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border-2 border-blue-400 bg-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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

              <div className="mt-6 flex gap-3 justify-end">
                <button
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 active:bg-slate-200 font-black text-xs transition-colors"
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
                    className={`px-4 py-2 rounded-lg border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 active:bg-red-200 font-black text-xs transition-colors ${
                      deleteBusy || !targetSection ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                    disabled={deleteBusy || !targetSection}
                    onClick={handleDeleteSection}
                  >
                    {deleteBusy ? "⏳ Moving & Deleting..." : "🗑️ Move & Delete Section"}
                  </button>
                )}

                {sectionItemCount === 0 && (
                  <button
                    className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 font-black text-xs transition-colors"
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
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <h3 className="text-xl font-black text-red-700 mb-4">
                Delete Group: {groupToDelete} (in {sectionToDelete})
              </h3>

              <p className="text-sm text-slate-700 mb-4">
                {groupItemCount > 0 ? (
                  <>This group contains <strong className="font-black">{groupItemCount}</strong> items.</>
                ) : (
                  <>This group is empty and will disappear after refresh.</>
                )}
              </p>

              {groupItemCount > 0 && (
                <p className="text-sm text-slate-600 mb-4">
                  Move these items to another group in the same section or to another section.
                </p>
              )}

              {groupItemCount > 0 && (
                <div className="mb-4">
                  <label className="block font-black text-sm text-slate-700 mb-2">
                    Move to section:
                  </label>
                  <select
                    value={targetSection}
                    onChange={(e) => {
                      setTargetSection(e.target.value);
                      setTargetGroup(ALL);
                    }}
                    className="w-full px-4 py-2.5 rounded-lg border-2 border-blue-400 bg-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                <div className="mb-4">
                  <label className="block font-black text-sm text-slate-700 mb-2">
                    Move to group (optional):
                  </label>
                  <select
                    value={targetGroup}
                    onChange={(e) => setTargetGroup(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border-2 border-blue-400 bg-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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

              <div className="mt-6 flex gap-3 justify-end">
                <button
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 active:bg-slate-200 font-black text-xs transition-colors"
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
                    className={`px-4 py-2 rounded-lg border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 active:bg-red-200 font-black text-xs transition-colors ${
                      deleteBusy || !targetSection ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                    disabled={deleteBusy || !targetSection}
                    onClick={handleDeleteGroup}
                  >
                    {deleteBusy ? "⏳ Moving & Deleting..." : "🗑️ Move & Delete Group"}
                  </button>
                )}

                {groupItemCount === 0 && (
                  <button
                    className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 font-black text-xs transition-colors"
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
