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
  const map: Record<string, Set<string>> = {};

  // 1. Start with known groups (including empty sections)
  for (const [sec, groups] of Object.entries(knownGroups)) {
    map[sec] = new Set(groups);
  }

  // 2. Add real data from items
  for (const it of items) {
    const sec = (it.section || "").trim();
    if (!sec) continue;

    if (!map[sec]) map[sec] = new Set();
    const grp = (it.group || "").trim();
    if (grp) map[sec].add(grp);
  }

  // 3. Fallback to defaults only if nothing at all
  if (Object.keys(map).length === 0) {
    for (const [sec, groups] of Object.entries(DEFAULT_SECTION_GROUPS)) {
      map[sec] = new Set(groups);
    }
  }

  // Convert Sets to sorted arrays
  const result: Record<string, string[]> = {};
  for (const sec of Object.keys(map).sort()) {
    result[sec] = Array.from(map[sec]).sort();
  }

  return result;
}

export default function AdminPage() {
  // ── Maintain Sections & Groups Modal States ─────────────────────────
  const logRef = useRef<HTMLPreElement>(null);
  const [showMaintainModal, setShowMaintainModal] = useState(false);
  const [maintainTab, setMaintainTab] = useState<"section" | "group" | "move-group" | "rename" | "delete-group">("section");
  const [newSectionName, setNewSectionName] = useState("");
  const [selectedSectionForGroup, setSelectedSectionForGroup] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [groupToMove, setGroupToMove] = useState("");
  const [targetSectionForMove, setTargetSectionForMove] = useState("");
  const [renameTarget, setRenameTarget] = useState<"section" | "group">("section");
  const [renameOldName, setRenameOldName] = useState("");
  const [renameNewName, setRenameNewName] = useState("");
  const [deleteGroupSection, setDeleteGroupSection] = useState("");
  const [groupToDelete, setGroupToDelete] = useState("");
  const [moveToGroupAfterDelete, setMoveToGroupAfterDelete] = useState("");
  const [maintainBusy, setMaintainBusy] = useState(false);

  // ── Register from S3 states ─────────────────────────────────────
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerPrefix, setRegisterPrefix] = useState("media/");
  const [missingFiles, setMissingFiles] = useState<any[]>([]);
  const [selectedMissing, setSelectedMissing] = useState<Set<string>>(new Set());
  const [registerSection, setRegisterSection] = useState("");
  const [registerGroup, setRegisterGroup] = useState("");
  const [registerNewSection, setRegisterNewSection] = useState("");
  const [registerNewGroup, setRegisterNewGroup] = useState("");
  const [registerBusy, setRegisterBusy] = useState(false);

  // ── Original states ─────────────────────────────────────────────
  const [token, setToken] = useState<string>("");
  const [authorized, setAuthorized] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [log, setLog] = useState<string[]>([]);
  const [allItems, setAllItems] = useState<MediaItem[]>([]);
  const [section, setSection] = useState<string>(ALL);
  const [group, setGroup] = useState<string>(ALL);
  const [search, setSearch] = useState<string>("");
  const [personFilter, setPersonFilter] = useState<string>("");
  const [titleFilter, setTitleFilter] = useState<string>("");
  const [uploadMode, setUploadMode] = useState<"file" | "url">("file");
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadUrl, setUploadUrl] = useState<string>("");
  const [uploadTitle, setUploadTitle] = useState<string>(""); // used ONLY for URL import
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
  const [showYouTubeModal, setShowYouTubeModal] = useState(false);
  const [showYouTubeProgress, setShowYouTubeProgress] = useState(false);
  const [youtubeVideos, setYoutubeVideos] = useState<any[]>([]);
  const [youtubeProgress, setYoutubeProgress] = useState<{
    current: number;
    total: number;
    currentVideo: string;
    status: string;
    details: Array<{
      title: string;
      status: "fetching" | "downloading" | "uploading" | "saving" | "done" | "error";
      uploadDate?: string;
      size?: string;
      s3Url?: string;
      error?: string;
    }>;
  }>({ current: 0, total: 0, currentVideo: "", status: "", details: [] });
  const [sectionToDelete, setSectionToDelete] = useState<string>("");
  const [groupToDeleteState, setGroupToDeleteState] = useState<string>("");
  const [targetSection, setTargetSection] = useState<string>("");
  const [targetGroup, setTargetGroup] = useState<string>(ALL);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [logCollapsed, setLogCollapsed] = useState(false);
  // Track known groups (newly created ones) so they appear even without items
  const [knownGroups, setKnownGroups] = useState<Record<string, Set<string>>>({});
  // SIGNED URL CACHE: PK -> signed URL
  const [signedUrlByPk, setSignedUrlByPk] = useState<Record<string, string>>({});
  const [signBusyByPk, setSignBusyByPk] = useState<Record<string, boolean>>({});

  // ── Derived: dynamic section → groups map ────────────────────────────
  const sectionMap = useMemo(() => buildSectionMap(allItems, knownGroups), [allItems, knownGroups]);
  const sectionList = useMemo(() => Object.keys(sectionMap).sort(), [sectionMap]);
  const groupOptions = useMemo(() => {
    if (section === ALL) {
      const all = new Set<string>();
      for (const groups of Object.values(sectionMap)) for (const g of groups) all.add(g);
      return Array.from(all).sort();
    }
    return sectionMap[section] || [];
  }, [sectionMap, section]);
  const allGroupOptions = useMemo(() => {
    const all = new Set<string>();
    for (const groups of Object.values(sectionMap)) for (const g of groups) all.add(g);
    return Array.from(all).sort();
  }, [sectionMap]);
  const sectionItemCount = useMemo(
    () => (section !== ALL ? allItems.filter((i) => i.section === section).length : 0),
    [allItems, section]
  );
  const groupItemCount = useMemo(
    () => (group !== ALL ? allItems.filter((i) => i.section === section && i.group === group).length : 0),
    [allItems, section, group]
  );
  // Profile pictures for person dropdown (when section is "Youtube Chanel Videos")
  const profilePictures = useMemo(() => {
    return allItems.filter((item) => item.section === "Youtube_Channel_Profile_Picture" && item.person);
  }, [allItems]);
  // Unique persons and titles for filter dropdowns
  const uniquePersons = useMemo(() => {
    const persons = new Set<string>();
    allItems.forEach((item) => {
      if (item.person && item.person.trim()) persons.add(item.person.trim());
    });
    return Array.from(persons).sort();
  }, [allItems]);
  const uniqueTitles = useMemo(() => {
    const titles = new Set<string>();
    allItems.forEach((item) => {
      if (item.title && item.title.trim()) titles.add(item.title.trim());
    });
    return Array.from(titles).sort();
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
    setLog((prev) => [`${nowTime()} ${line}`, ...prev].slice(0, 400));
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

async function createNewSection() {
  const name = newSectionName.trim();
  if (!name) {
    pushLog("❌ Section name is required");
    return;
  }

  setMaintainBusy(true);
  try {
    // Optimistic UI update
    setKnownGroups((prev) => {
      const copy = { ...prev };
      if (!copy[name]) copy[name] = new Set();
      return copy;
    });

    const res = await apiJson("/api/admin/create-group", {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ section: name, group: "" }),
    });

    if (res.ok && res.data?.success) {
      pushLog(`✅ Created new section: ${name}`);
      setNewSectionName("");
      // Force refresh after 1 second to ensure backend sync
      setTimeout(() => refreshAll(), 1000);
    } else {
      pushLog(`Failed to create section: ${res.data?.error || res.text || "Unknown error"}`);
      // Rollback optimistic update if failed
      setKnownGroups((prev) => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
  } catch (e: any) {
    pushLog(`Error creating section: ${e.message}`);
  } finally {
    setMaintainBusy(false);
  }
}

async function createNewGroup() {
  const sec = selectedSectionForGroup.trim();
  const grp = newGroupName.trim();
  if (!sec || !grp) {
    pushLog("❌ Both section and group name are required");
    return;
  }

  setMaintainBusy(true);
  try {
    // Optimistic UI update
    setKnownGroups((prev) => {
      const copy = { ...prev };
      if (!copy[sec]) copy[sec] = new Set();
      copy[sec].add(grp);
      return copy;
    });

    const res = await apiJson("/api/admin/create-group", {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ section: sec, group: grp }),
    });

    if (res.ok && res.data?.success) {
      pushLog(`✅ Created new group "${grp}" in section "${sec}"`);
      setNewGroupName("");
      setTimeout(() => refreshAll(), 1000);
    } else {
      pushLog(`Failed to create group: ${res.data?.error || res.text || "Unknown error"}`);
      // Rollback optimistic
      setKnownGroups((prev) => {
        const copy = { ...prev };
        if (copy[sec]) copy[sec].delete(grp);
        return copy;
      });
    }
  } catch (e: any) {
    pushLog(`Error creating group: ${e.message}`);
  } finally {
    setMaintainBusy(false);
  }
}

  async function moveGroup() {
    const grp = groupToMove.trim();
    const newSec = targetSectionForMove.trim();
    if (!grp || !newSec) {
      pushLog("❌ Group name and target section are required");
      return;
    }
    setMaintainBusy(true);
    try {
      const itemsInGroup = allItems.filter((i) => i.group === grp);
      let success = 0;
      for (const item of itemsInGroup) {
        const payload = {
          PK: item.PK,
          section: newSec,
          group: grp, // keep group name
        };
        const out = await apiJson("/api/admin/slides", {
          method: "PATCH",
          headers: { "content-type": "application/json", "x-admin-token": token },
          body: JSON.stringify(payload),
        });
        if (out.ok) success++;
      }
      pushLog(`Moved group "${grp}" to section "${newSec}" (${success}/${itemsInGroup.length} items)`);
      await refreshAll();
    } catch (e: any) {
      pushLog(`Error moving group: ${e.message}`);
    } finally {
      setMaintainBusy(false);
    }
  }

  async function renameItem() {
    const isSection = renameTarget === "section";
    const oldName = renameOldName.trim();
    const newName = renameNewName.trim();
    if (!oldName || !newName) {
      pushLog("❌ Old and new names are required");
      return;
    }
    setMaintainBusy(true);
    try {
      const filterKey = isSection ? "section" : "group";
      const itemsToUpdate = allItems.filter((i) => i[filterKey] === oldName);
      let success = 0;
      for (const item of itemsToUpdate) {
        const payload = {
          PK: item.PK,
          [filterKey]: newName,
        };
        const out = await apiJson("/api/admin/slides", {
          method: "PATCH",
          headers: { "content-type": "application/json", "x-admin-token": token },
          body: JSON.stringify(payload),
        });
        if (out.ok) success++;
      }
      pushLog(`Renamed ${isSection ? "section" : "group"} "${oldName}" → "${newName}" (${success}/${itemsToUpdate.length} items)`);
      await refreshAll();
    } catch (e: any) {
      pushLog(`Error renaming: ${e.message}`);
    } finally {
      setMaintainBusy(false);
    }
  }

  async function deleteGroupAndMove() {
    const sec = deleteGroupSection.trim();
    const grp = groupToDelete.trim();
    const targetGrp = moveToGroupAfterDelete.trim() || "";
    if (!sec || !grp) {
      pushLog("❌ Section and group to delete are required");
      return;
    }
    setMaintainBusy(true);
    try {
      const itemsToMove = allItems.filter((i) => i.section === sec && i.group === grp);
      let success = 0;
      for (const item of itemsToMove) {
        const payload = {
          PK: item.PK,
          group: targetGrp,
        };
        const out = await apiJson("/api/admin/slides", {
          method: "PATCH",
          headers: { "content-type": "application/json", "x-admin-token": token },
          body: JSON.stringify(payload),
        });
        if (out.ok) success++;
      }
      pushLog(`Moved ${success}/${itemsToMove.length} items from group "${grp}" → "${targetGrp || '(none)'}" in section "${sec}"`);
      await refreshAll();
    } catch (e: any) {
      pushLog(`Error deleting/moving group: ${e.message}`);
    } finally {
      setMaintainBusy(false);
    }
  }

  // ── Register from S3 Functions ──────────────────────────────────────
  async function scanMissingFiles() {
    setRegisterBusy(true);
    try {
      const res = await apiJson(
        `/api/admin/register-from-s3?prefix=${encodeURIComponent(registerPrefix)}`,
        { method: "GET", headers: { "x-admin-token": token } }
      );
      if (res.ok && res.data?.ok) {
        setMissingFiles(res.data.missing || []);
        setSelectedMissing(new Set());
        pushLog(`Found ${res.data.missingCount || 0} unregistered files in ${registerPrefix}`);
      } else {
        pushLog(`Scan failed: ${res.data?.error || res.text || "Unknown error"}`);
      }
    } catch (e: any) {
      pushLog(`Scan error: ${e.message}`);
    } finally {
      setRegisterBusy(false);
    }
  }

  async function registerSelectedMissing() {
    if (selectedMissing.size === 0) return;

    const sec = registerSection === "__NEW__" ? registerNewSection.trim() : registerSection;
    const grp = registerGroup === "__NEW__" ? registerNewGroup.trim() : registerGroup;

    if (!sec) {
      pushLog("❌ Section is required");
      return;
    }

    setRegisterBusy(true);
    try {
      const keys = Array.from(selectedMissing);
      const res = await apiJson("/api/admin/register-from-s3", {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-token": token },
        body: JSON.stringify({
          prefix: registerPrefix,
          section: sec,
          group: grp || "",
          selectedKeys: keys,
        }),
      });

      if (res.ok && res.data?.ok) {
        pushLog(`✅ Registered ${res.data.created} new items!`);
        setShowRegisterModal(false);
        await refreshAll();
      } else {
        pushLog(`Register failed: ${res.data?.error || res.text || "Unknown error"}`);
      }
    } catch (e: any) {
      pushLog(`Register error: ${e.message}`);
    } finally {
      setRegisterBusy(false);
    }
  }

  async function bulkRegisterByType(type: "image" | "video" | "audio") {
    const typeMap = {
      image: ["jpg", "jpeg", "png", "webp", "gif"],
      video: ["mp4", "mov", "webm"],
      audio: ["mp3", "wav", "m4a"],
    };

    const extensions = typeMap[type];
    const filesOfType = missingFiles.filter((f) => {
      const ext = f.filename.split(".").pop()?.toLowerCase() || "";
      return extensions.includes(ext);
    });

    if (filesOfType.length === 0) {
      pushLog(`No ${type} files found to register`);
      return;
    }

    const typeName = type === "image" ? "images" : type === "video" ? "videos" : "audio files";
    if (!confirm(`Register all ${filesOfType.length} ${typeName}?`)) return;

    const sec = registerSection === "__NEW__" ? registerNewSection.trim() : registerSection;
    const grp = registerGroup === "__NEW__" ? registerNewGroup.trim() : registerGroup;

    if (!sec) {
      pushLog("❌ Please select a section first");
      return;
    }

    setRegisterBusy(true);
    try {
      const keys = filesOfType.map((f) => f.key);
      const res = await apiJson("/api/admin/register-from-s3", {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-token": token },
        body: JSON.stringify({
          prefix: registerPrefix,
          section: sec,
          group: grp || "",
          selectedKeys: keys,
        }),
      });

      if (res.ok && res.data?.ok) {
        pushLog(`✅ Bulk registered ${res.data.created} ${typeName}!`);
        setShowRegisterModal(false);
        await refreshAll();
      } else {
        pushLog(`Bulk register failed: ${res.data?.error || res.text || "Unknown error"}`);
      }
    } catch (e: any) {
      pushLog(`Error during bulk register: ${e.message}`);
    } finally {
      setRegisterBusy(false);
    }
  }

  // ── Original helper functions ───────────────────────────────────────
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

  function s3KeyFromPublicUrl(publicUrl: string): string | null {
    try {
      const u = new URL(publicUrl);
      const key = u.pathname?.replace(/^\/+/, "");
      if (!key) return null;
      return key;
    } catch {
      return null;
    }
  }

  async function ensureSignedUrl(it: MediaItem) {
    if (signedUrlByPk[it.PK]) return;
    const key = s3KeyFromPublicUrl(it.url);
    if (!key) return;
    if (signBusyByPk[it.PK]) return;
    setSignBusyByPk((prev) => ({ ...prev, [it.PK]: true }));
    try {
      const out = await apiJson(`/api/admin/presign-get?key=${encodeURIComponent(key)}`, {
        method: "GET",
        cache: "no-store",
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
  }

  function renderableUrl(it: MediaItem): string {
    return signedUrlByPk[it.PK] || it.url;
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
      setSignedUrlByPk({});
      setSignBusyByPk({});
      pushLog(`Loaded: ${loaded.length} total items`);
    } catch (e: any) {
      pushLog(`❌ ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const filteredItems: MediaItem[] = useMemo(() => {
    let result = allItems;
    if (section !== ALL) result = result.filter((it) => it.section === section);
    if (group !== ALL) result = result.filter((it) => (it.group || "") === group);
    if (personFilter) result = result.filter((it) => (it.person || "").trim() === personFilter);
    if (titleFilter) result = result.filter((it) => (it.title || "").trim() === titleFilter);
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
  }, [allItems, search, section, group, personFilter, titleFilter]);

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
    const sec = resolveUploadSection();
    const grp = resolveUploadGroup();
    if (!authorized || !sec || !grp || uploadFiles.length === 0) {
      pushLog("❌ Upload requirements not met (need Section, Group, and file(s))");
      return;
    }
    if (sec === "Youtube Chanel Videos" && !uploadPerson.trim()) {
      pushLog("❌ Person is required for Youtube Chanel Videos section");
      return;
    }
    const titleFromFilename = (name: string) => (name || "").replace(/\.[^/.]+$/, "").trim() || name;
    setBusy(true);
    try {
      pushLog(`Uploading ${uploadFiles.length} file(s) to ${sec} → ${grp}...`);
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
          group: grp,
          title: titleFromFilename(f.name),
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

  async function importFromUrl() {
    if (!authorized || !uploadUrl.trim() || !uploadTitle.trim() || !resolveUploadSection() || !resolveUploadGroup()) {
      pushLog("❌ Import requirements not met");
      return;
    }
    const sec = resolveUploadSection();
    const grp = resolveUploadGroup();
    if (sec === "Youtube Chanel Videos" && !uploadPerson.trim()) {
      pushLog("❌ Person is required for Youtube Chanel Videos section");
      return;
    }
    setBusy(true);
    try {
      pushLog(`Importing from URL: ${uploadUrl.trim().slice(0, 80)}...`);
      const payload: any = {
        url: uploadUrl.trim(),
        section: sec,
        title: uploadTitle.trim(),
        group: grp,
      };
      if (uploadPerson.trim()) payload.person = uploadPerson.trim();
      if (uploadDate.trim()) payload.date = uploadDate.trim();
      if (uploadDescription.trim()) payload.description = uploadDescription.trim();
      const out = await apiJson("/api/admin/import-url", {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-token": token },
        body: JSON.stringify(payload),
      });
      if (!out.ok) throw new Error(out.data?.detail || out.data?.error || `Import failed (HTTP ${out.status})`);
      pushLog(`✅ Imported: ${out.data?.title || uploadTitle.trim()} (${out.data?.PK})`);
      clearUpload();
      await refreshAll();
    } catch (e: any) {
      pushLog(`❌ Import failed: ${e?.message ?? String(e)}`);
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
      pushLog("❌ Section is required");
      return;
    }
    if (destSection === "Youtube Chanel Videos" && !editingFields.person?.trim()) {
      pushLog("❌ Person is required for Youtube Chanel Videos section");
      return;
    }
    setBusy(true);
    try {
      const sectionChanged = destSection !== it.section;
      const groupChanged = destGroup !== (it.group || "");
      let newUrl = it.url;
      if (editFile) {
        pushLog(`Uploading new file for ${it.PK}...`);
        const pres = await presignOne(editFile, destSection);
        const contentType = guessContentType(editFile);
        const putRes = await fetch(pres.uploadUrl, {
          method: "PUT",
          headers: { "content-type": contentType },
          body: editFile,
        });
        if (!putRes.ok) throw new Error(`S3 upload failed (HTTP ${putRes.status}) ${editFile.name}`);
        newUrl = pres.publicUrl;
        pushLog(`✅ New file uploaded`);
      }
      const payload: any = {
        PK: it.PK,
        title: editingFields.title,
        description: editingFields.description,
        person: editingFields.person,
        date: editingFields.date,
        section: destSection,
        group: destGroup,
        url: newUrl,
      };
      const out = await apiJson("/api/admin/slides", {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-admin-token": token },
        body: JSON.stringify(payload),
      });
      if (!out.ok) throw new Error(out.data?.detail || out.data?.error || "Update failed");
      if (sectionChanged) pushLog(`➡️ Moved ${it.PK}: ${it.section} → ${destSection}`);
      else if (groupChanged) pushLog(`➡️ Moved ${it.PK}: group ${it.group || "(none)"} → ${destGroup || "(none)"}`);
      else pushLog(`✏️ Updated: ${it.PK}`);
      cancelEditing();
      await refreshAll();
      if (sectionChanged || groupChanged) {
        setSection(destSection);
        setTimeout(() => setGroup(destGroup || ALL), 50);
      }
    } catch (e: any) {
      pushLog(`❌ ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteSection() {
    if (!targetSection || targetSection === sectionToDelete) {
      pushLog("❌ Invalid target section");
      return;
    }
    setDeleteBusy(true);
    pushLog(`Starting move & delete of section "${sectionToDelete}" → "${targetSection}"`);
    try {
      const itemsToMove = allItems.filter((i) => i.section === sectionToDelete);
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
          if (out.ok) success++;
          else pushLog(`Failed to move ${item.PK}: ${out.data?.error || out.data?.detail || "Unknown error"}`);
        }
        pushLog(`Moved ${success} of ${count} items`);
      }
      await refreshAll();
      await new Promise((r) => setTimeout(r, 600));
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
      pushLog("❌ No target section selected");
      return;
    }
    setDeleteBusy(true);
    const targetGrp = targetGroup === ALL ? "" : targetGroup;
    pushLog(
      `Deleting group "${groupToDeleteState}" in "${sectionToDelete}" → "${targetSection}" / "${targetGrp || "(none)"}"`
    );
    try {
      const itemsToMove = allItems.filter((i) => i.section === sectionToDelete && i.group === groupToDeleteState);
      const count = itemsToMove.length;
      if (count === 0) {
        pushLog(`Group "${groupToDeleteState}" is already empty → refreshing`);
      } else {
        pushLog(`Moving ${count} items`);
        let success = 0;
        for (const item of itemsToMove) {
          const payload = { PK: item.PK, section: targetSection, group: targetGrp };
          const out = await apiJson("/api/admin/slides", {
            method: "PATCH",
            headers: { "content-type": "application/json", "x-admin-token": token },
            body: JSON.stringify(payload),
          });
          if (out.ok) success++;
          else pushLog(`Failed to move ${item.PK}: ${out.data?.error || out.data?.detail || "Unknown error"}`);
        }
        pushLog(`Moved ${success} of ${count} items`);
      }
      await refreshAll();
      await new Promise((r) => setTimeout(r, 600));
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

  // ── Escape key handler ──────────────────────────────────────────────
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowUploadModal(false);
        setShowDeleteSectionModal(false);
        setShowDeleteGroupModal(false);
        setShowYouTubeModal(false);
        setShowRegisterModal(false);
        setShowMaintainModal(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  // ── YouTube progress listener ──────────────────────────────────────
  useEffect(() => {
    const handleProgress = (e: any) => {
      const { index, status, s3Url, size, error, allDone, current } = e.detail;
      if (allDone) {
        setYoutubeProgress((prev) => ({
          ...prev,
          current: prev.total,
          status: "🎉 All videos processed!",
        }));
        return;
      }
      setYoutubeProgress((prev) => {
        const newDetails = [...prev.details];
        if (index !== undefined && newDetails[index]) {
          newDetails[index] = { ...newDetails[index], status, s3Url, size, error };
        }
        return {
          ...prev,
          details: newDetails,
          current: current !== undefined ? current + 1 : prev.current,
          currentVideo: newDetails[index]?.title || prev.currentVideo,
          status:
            status === "downloading"
              ? `⬇️ Downloading video ${index + 1}...`
              : status === "uploading"
              ? `⬆️ Uploading video ${index + 1}...`
              : status === "saving"
              ? `💾 Saving video ${index + 1}...`
              : status === "done"
              ? `✅ Video ${index + 1} complete!`
              : status === "error"
              ? `❌ Video ${index + 1} failed`
              : prev.status,
        };
      });
    };
    window.addEventListener("youtube-progress", handleProgress as EventListener);
    return () => window.removeEventListener("youtube-progress", handleProgress as EventListener);
  }, []);

  // ── JSX ─────────────────────────────────────────────────────────────
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
                authorized ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
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
              <>
                <button
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm transition-colors shadow-lg"
                  onClick={() => setShowUploadModal(true)}
                  disabled={busy}
                >
                  ➕ Add Media
                </button>
                <button
                  className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 active:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm transition-colors shadow-lg"
                  onClick={() => setShowYouTubeModal(true)}
                  disabled={busy}
                >
                  📺 Add Latest Videos from YouTube Channel-s
                </button>
                <button
                  onClick={() => setShowRegisterModal(true)}
                  disabled={busy}
                  className="px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 font-bold text-sm transition-colors shadow-lg"
                >
                  🔍 Scan & Register from S3
                </button>
                <button
                  onClick={() => setShowMaintainModal(true)}
                  disabled={busy}
                  className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 font-bold text-sm transition-colors shadow-lg"
                >
                  ⚙️ Maintain Sections-Groups
                </button>
              </>
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
                setSignedUrlByPk({});
                setSignBusyByPk({});
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
          <div className={`transition-all duration-200 ${authorized ? "opacity-100" : "opacity-40 blur-sm pointer-events-none"}`}>
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
                <select
                  value={personFilter}
                  onChange={(e) => setPersonFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={busy || !authorized}
                >
                  <option value="">All Persons</option>
                  {uniquePersons.map((person) => (
                    <option key={person} value={person}>
                      {person}
                    </option>
                  ))}
                </select>
                <select
                  value={titleFilter}
                  onChange={(e) => setTitleFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={busy || !authorized}
                >
                  <option value="">All Titles</option>
                  {uniqueTitles.map((title) => (
                    <option key={title} value={title}>
                      {title}
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
                {(section !== ALL || group !== ALL || search || personFilter || titleFilter) && (
                  <button
                    onClick={() => {
                      setSection(ALL);
                      setGroup(ALL);
                      setSearch("");
                      setPersonFilter("");
                      setTitleFilter("");
                    }}
                    className="px-2 py-1 rounded text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                  >
                    Clear All
                  </button>
                )}
                <div className="ml-auto flex items-center">
                  <span className="px-2 py-1 rounded bg-slate-100 text-xs font-bold text-slate-700">
                    {filteredItems.length}/{allItems.length}
                  </span>
                </div>
              </div>
            </section>

            {/* Items List */}
            <section className="mb-4">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-base font-black text-slate-900">
                  {filteredItems.length} Item{filteredItems.length !== 1 ? "s" : ""}{" "}
                  {section !== ALL ? `in ${section}` : ""} {group !== ALL ? `→ ${group}` : ""}
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredItems.map((it) => {
                  const src = renderableUrl(it);
                  const usingSigned = !!signedUrlByPk[it.PK];
                  const signBusy = !!signBusyByPk[it.PK];
                  return (
                    <div
                      key={it.PK}
                      className={`group border border-slate-200 rounded-lg bg-white shadow-sm hover:shadow-lg transition-all overflow-hidden ${
                        editingPK === it.PK ? "md:col-span-2 lg:col-span-3" : ""
                      }`}
                      onMouseEnter={() => {
                        if (isVideo(it.url) || isImage(it.url)) void ensureSignedUrl(it);
                      }}
                    >
                      {/* Thumbnail Preview */}
                      <div className="relative aspect-video bg-slate-100 overflow-hidden">
                        {isVideo(it.url) ? (
                          <video src={src} className="w-full h-full object-cover" preload="metadata" muted />
                        ) : isImage(it.url) ? (
                          <img src={src} alt={it.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-200">
                            <span className="text-slate-400 text-2xl">📄</span>
                          </div>
                        )}
                        {(isVideo(it.url) || isImage(it.url)) && (
                          <div className="absolute left-2 top-2">
                            {signBusy ? (
                              <span className="px-2 py-1 rounded bg-slate-900/80 text-white text-[11px] font-black">
                                ⏳ signing
                              </span>
                            ) : usingSigned ? (
                              <span className="px-2 py-1 rounded bg-emerald-600/90 text-white text-[11px] font-black">
                                🔓 signed
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded bg-slate-700/70 text-white text-[11px] font-black">
                                link
                              </span>
                            )}
                          </div>
                        )}
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
                      {editingPK !== it.PK ? (
                        <div className="p-3">
                          <div className="text-xs text-slate-500 font-bold mb-1 truncate">{it.PK}</div>
                          <h3 className="text-sm font-black text-slate-900 mb-2 line-clamp-2 min-h-[2.5rem]">
                            {it.title}
                          </h3>
                          <div className="space-y-1 text-xs text-slate-600">
                            {it.section && (
                              <div className="truncate">
                                <span className="font-semibold">Section:</span> {it.section}
                              </div>
                            )}
                            {it.group && (
                              <div className="truncate">
                                <span className="font-semibold">Group:</span> {it.group}
                              </div>
                            )}
                            {it.person && (
                              <div className="truncate">
                                <span className="font-semibold">Person:</span> {it.person}
                              </div>
                            )}
                          </div>
                          <div className="mt-2 flex items-center gap-3">
                            <a
                              href={src}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-block text-xs text-blue-600 hover:text-blue-700 font-semibold"
                              onClick={(e) => e.stopPropagation()}
                            >
                              🔗 Open
                            </a>
                            {(isVideo(it.url) || isImage(it.url)) && (
                              <button
                                className="text-xs font-bold text-slate-700 hover:text-slate-900"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void ensureSignedUrl(it);
                                }}
                                disabled={signBusy}
                                title="Get signed URL"
                              >
                                {signBusy ? "⏳ Signing..." : "🔓 Get signed"}
                              </button>
                            )}
                          </div>
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
                                    <option value="">-- Select --</option>
                                    {((editingFields.section && sectionMap[String(editingFields.section)]) || []).map(
                                      (g) => (
                                        <option key={g} value={g}>
                                          {g}
                                        </option>
                                      )
                                    )}
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
                                Person{" "}
                                {resolveEditSection() === "Youtube Chanel Videos" ? (
                                  <span className="text-red-500">*</span>
                                ) : (
                                  "(optional)"
                                )}
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
                                onChange={(e) =>
                                  setEditingFields({ ...editingFields, description: e.target.value })
                                }
                                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm min-h-[80px] resize-y"
                              />
                            </div>
                            {resolveEditSection() === "Youtube_Channel_Profile_Picture" && (
                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-2">
                                  Replace Image (optional)
                                </label>
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
                                    Current:{" "}
                                    <a
                                      href={renderableUrl(it)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-500 hover:underline"
                                    >
                                      View current image
                                    </a>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {!filteredItems.length && (
                  <div className="opacity-70 font-bold p-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-center text-sm text-slate-600">
                    {allItems.length === 0
                      ? "No items uploaded yet."
                      : `No items match the current filter (${filterLabel}${group !== ALL ? ` → ${filterGroupLabel}` : ""}).`}
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
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      Group <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={uploadGroup}
                      onChange={(e) => {
                        setUploadGroup(e.target.value);
                        setUploadNewGroup("");
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={busy || !authorized || !uploadSection || uploadSection === "__NEW__"}
                    >
                      <option value="">-- Select --</option>
                      {(uploadSection && sectionMap[uploadSection] ? sectionMap[uploadSection] : []).map((g) => (
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
                              pushLog("❌ Please enter a group name");
                              return;
                            }
                            if (!uploadSection || uploadSection === "__NEW__") {
                              pushLog("❌ Select a section first");
                              return;
                            }
                            setBusy(true);
                            try {
                              const finalSection = resolveUploadSection();
                              const payload = { section: finalSection, group: uploadNewGroup.trim() };
                              const res = await fetch("/api/admin/create-group", {
                                method: "POST",
                                headers: { "Content-Type": "application/json", "x-admin-token": token },
                                body: JSON.stringify(payload),
                              });
                              const data = await res.json();
                              if (res.ok && data.success) {
                                pushLog(`✅ Group "${uploadNewGroup.trim()}" created in "${finalSection}"`);
                                setKnownGroups((prev) => {
                                  const copy: Record<string, Set<string>> = { ...prev };
                                  if (!copy[finalSection]) copy[finalSection] = new Set();
                                  copy[finalSection].add(uploadNewGroup.trim());
                                  return copy;
                                });
                                setUploadGroup(uploadNewGroup.trim());
                                setUploadNewGroup("");
                                await refreshAll();
                              } else {
                                pushLog(`❌ Failed: ${data.error || "Unknown error"}`);
                              }
                            } catch (err: any) {
                              pushLog(`❌ Error creating group: ${err.message}`);
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
                {/* URL mode needs Title; FILE mode auto-title from filename */}
                {uploadMode === "url" ? (
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
                        Person{" "}
                        {resolveUploadSection() === "Youtube Chanel Videos" ? (
                          <span className="text-red-500">*</span>
                        ) : (
                          "(optional)"
                        )}
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
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">
                        Title
                      </label>
                      <div className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 text-sm font-bold text-slate-600">
                        Auto from filename (.mp4 → title)
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">
                        Person{" "}
                        {resolveUploadSection() === "Youtube Chanel Videos" ? (
                          <span className="text-red-500">*</span>
                        ) : (
                          "(optional)"
                        )}
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
                    <div className="sm:col-span-2">
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
                )}
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
                        <div className="mt-2 text-xs text-slate-600 font-bold">✓ Selected: {uploadFiles.length} file(s)</div>
                      )}
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button
                        className="flex-1 px-4 py-3 rounded-lg bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 disabled:opacity-50 disabled:cursor-not-allowed font-black text-sm transition-colors shadow-lg"
                        onClick={uploadMedia}
                        disabled={
                          !authorized ||
                          busy ||
                          !uploadFiles.length ||
                          !resolveUploadSection().trim() ||
                          !resolveUploadGroup().trim() ||
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
                          !resolveUploadSection().trim() ||
                          !resolveUploadGroup().trim() ||
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
              <h3 className="text-xl font-black text-red-700 mb-4">Delete Section: {sectionToDelete}</h3>
              <p className="text-sm text-slate-700 mb-4">
                {sectionItemCount > 0 ? (
                  <>
                    This section contains <strong className="font-black">{sectionItemCount}</strong> items.
                  </>
                ) : (
                  <>This section is empty and will disappear after refresh.</>
                )}
              </p>
              {sectionItemCount > 0 && (
                <>
                  <p className="text-sm text-slate-600 mb-4">
                    You must move these items to another section before deletion.
                  </p>
                  <div className="mb-4">
                    <label className="block font-black text-sm text-slate-700 mb-2">Move to section:</label>
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
                  {targetSection && sectionMap[targetSection]?.length > 0 && (
                    <div className="mb-4">
                      <label className="block font-black text-sm text-slate-700 mb-2">Move to group (optional):</label>
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
                </>
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
                {sectionItemCount > 0 ? (
                  <button
                    className={`px-4 py-2 rounded-lg border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 active:bg-red-200 font-black text-xs transition-colors ${
                      deleteBusy || !targetSection ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                    disabled={deleteBusy || !targetSection}
                    onClick={handleDeleteSection}
                  >
                    {deleteBusy ? "⏳ Moving & Deleting..." : "🗑️ Move & Delete Section"}
                  </button>
                ) : (
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
                Delete Group: {groupToDeleteState} (in {sectionToDelete})
              </h3>
              <p className="text-sm text-slate-700 mb-4">
                {groupItemCount > 0 ? (
                  <>
                    This group contains <strong className="font-black">{groupItemCount}</strong> items.
                  </>
                ) : (
                  <>This group is empty and will disappear after refresh.</>
                )}
              </p>
              {groupItemCount > 0 && (
                <>
                  <p className="text-sm text-slate-600 mb-4">
                    Move these items to another group in the same section or to another section.
                  </p>
                  <div className="mb-4">
                    <label className="block font-black text-sm text-slate-700 mb-2">Move to section:</label>
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
                  {targetSection && sectionMap[targetSection]?.length > 0 && (
                    <div className="mb-4">
                      <label className="block font-black text-sm text-slate-700 mb-2">Move to group (optional):</label>
                      <select
                        value={targetGroup}
                        onChange={(e) => setTargetGroup(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border-2 border-blue-400 bg-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      >
                        <option value={ALL}>No specific group (root of section)</option>
                        {sectionMap[targetSection]
                          .filter((g) => targetSection !== sectionToDelete || g !== groupToDeleteState)
                          .map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </>
              )}
              <div className="mt-6 flex gap-3 justify-end">
                <button
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 active:bg-slate-200 font-black text-xs transition-colors"
                  onClick={() => {
                    setShowDeleteGroupModal(false);
                    setSectionToDelete("");
                    setGroupToDeleteState("");
                    setTargetSection("");
                    setTargetGroup(ALL);
                  }}
                >
                  Cancel
                </button>
                {groupItemCount > 0 ? (
                  <button
                    className={`px-4 py-2 rounded-lg border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 active:bg-red-200 font-black text-xs transition-colors ${
                      deleteBusy || !targetSection ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                    disabled={deleteBusy || !targetSection}
                    onClick={handleDeleteGroup}
                  >
                    {deleteBusy ? "⏳ Moving & Deleting..." : "🗑️ Move & Delete Group"}
                  </button>
                ) : (
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

        {/* YouTube Channel Import Modal */}
        {showYouTubeModal && (
          <YouTubeImportModal
            token={token}
            onClose={() => setShowYouTubeModal(false)}
            onStartProgress={(videos) => {
              setYoutubeVideos(videos);
              setShowYouTubeModal(false);
              setShowYouTubeProgress(true);
              setYoutubeProgress({
                current: 0,
                total: videos.length,
                currentVideo: "",
                status: "Starting...",
                details: videos.map((v) => ({
                  title: v.title,
                  status: "fetching",
                  uploadDate: v.uploadDate,
                })),
              });
            }}
            pushLog={pushLog}
            allGroupOptions={allGroupOptions}
            busy={busy}
            setBusy={setBusy}
          />
        )}

        {/* YouTube Progress View */}
        {showYouTubeProgress && (
          <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-black text-slate-900">🚀 Downloading & Uploading Videos</h2>
              <div className="text-sm font-bold text-slate-600">
                {youtubeProgress.current} / {youtubeProgress.total} Complete
              </div>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3 mb-6">
              <div
                className="bg-green-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${(youtubeProgress.current / youtubeProgress.total) * 100}%` }}
              />
            </div>
            {youtubeProgress.status && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-bold text-blue-900">{youtubeProgress.status}</p>
              </div>
            )}
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {youtubeProgress.details.map((video, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border-2 ${
                    video.status === "done"
                      ? "bg-green-50 border-green-300"
                      : video.status === "error"
                      ? "bg-red-50 border-red-300"
                      : video.status === "downloading" || video.status === "uploading" || video.status === "saving"
                      ? "bg-blue-50 border-blue-300"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900 mb-2">
                        {idx + 1}. {video.title}
                      </h3>
                      {video.uploadDate && <p className="text-xs text-slate-600 mb-1">📅 Uploaded: {video.uploadDate}</p>}
                      <div className="flex items-center gap-2">
                        {video.status === "fetching" && <span className="text-sm text-slate-600">⏳ Waiting...</span>}
                        {video.status === "downloading" && (
                          <span className="text-sm text-blue-600 font-bold">⬇️ Downloading from YouTube...</span>
                        )}
                        {video.status === "uploading" && (
                          <span className="text-sm text-blue-600 font-bold">⬆️ Uploading to S3...</span>
                        )}
                        {video.status === "saving" && (
                          <span className="text-sm text-blue-600 font-bold">💾 Saving to DynamoDB...</span>
                        )}
                        {video.status === "done" && (
                          <>
                            <span className="text-sm text-green-600 font-bold">✅ Complete!</span>
                            {video.size && <span className="text-xs text-slate-600">({video.size})</span>}
                          </>
                        )}
                        {video.status === "error" && <span className="text-sm text-red-600 font-bold">❌ Failed</span>}
                      </div>
                      {video.s3Url && (
                        <a
                          href={video.s3Url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                        >
                          🔗 View in S3
                        </a>
                      )}
                      {video.error && <p className="text-xs text-red-600 mt-1">Error: {video.error}</p>}
                    </div>
                    <div className="ml-4">
                      {video.status === "done" && <div className="text-2xl">✅</div>}
                      {video.status === "error" && <div className="text-2xl">❌</div>}
                      {(video.status === "downloading" || video.status === "uploading" || video.status === "saving") && (
                        <div className="text-2xl animate-spin">⏳</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {youtubeProgress.current === youtubeProgress.total && (
              <div className="mt-6 flex gap-3">
                <button
                  onClick={async () => {
                    setShowYouTubeProgress(false);
                    setYoutubeVideos([]);
                    await refreshAll();
                  }}
                  className="flex-1 px-4 py-3 rounded-lg bg-green-600 text-white hover:bg-green-700 font-bold text-sm transition-colors"
                >
                  ✅ Done! Refresh Page
                </button>
                <button
                  onClick={() => setShowYouTubeModal(true)}
                  className="px-4 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-bold text-sm transition-colors"
                >
                  ➕ Import More Videos
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Maintain Sections-Groups Modal ─────────────────────────────── */}
        {showMaintainModal && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowMaintainModal(false)}
          >
            <div
              className="bg-white rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-slate-900">⚙️ Maintain Sections & Groups</h2>
                <button
                  onClick={() => setShowMaintainModal(false)}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b mb-6 overflow-x-auto">
                <button
                  className={`flex-1 py-3 font-medium text-center min-w-[120px] ${
                    maintainTab === "section" ? "border-b-4 border-purple-600 text-purple-700" : "text-slate-600 hover:text-slate-800"
                  }`}
                  onClick={() => setMaintainTab("section")}
                >
                  New Section
                </button>
                <button
                  className={`flex-1 py-3 font-medium text-center min-w-[120px] ${
                    maintainTab === "group" ? "border-b-4 border-purple-600 text-purple-700" : "text-slate-600 hover:text-slate-800"
                  }`}
                  onClick={() => setMaintainTab("group")}
                >
                  New Group
                </button>
                <button
                  className={`flex-1 py-3 font-medium text-center min-w-[120px] ${
                    maintainTab === "move-group" ? "border-b-4 border-purple-600 text-purple-700" : "text-slate-600 hover:text-slate-800"
                  }`}
                  onClick={() => setMaintainTab("move-group")}
                >
                  Move Group
                </button>
                <button
                  className={`flex-1 py-3 font-medium text-center min-w-[120px] ${
                    maintainTab === "rename" ? "border-b-4 border-purple-600 text-purple-700" : "text-slate-600 hover:text-slate-800"
                  }`}
                  onClick={() => setMaintainTab("rename")}
                >
                  Rename
                </button>
                <button
                  className={`flex-1 py-3 font-medium text-center min-w-[140px] ${
                    maintainTab === "delete-group" ? "border-b-4 border-purple-600 text-purple-700" : "text-slate-600 hover:text-slate-800"
                  }`}
                  onClick={() => setMaintainTab("delete-group")}
                >
                  Delete Group
                </button>
              </div>

              {maintainBusy && (
                <div className="text-center py-6 text-purple-600 font-medium">
                  Processing...
                </div>
              )}

              {/* New Section Tab */}
              {maintainTab === "section" && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      New Section Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newSectionName}
                      onChange={(e) => setNewSectionName(e.target.value)}
                      placeholder="e.g. New Category"
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      disabled={maintainBusy}
                    />
                  </div>
                  <button
                    onClick={createNewSection}
                    disabled={maintainBusy || !newSectionName.trim()}
                    className="w-full py-3 px-6 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl disabled:opacity-50 transition-colors"
                  >
                    Create New Section
                  </button>
                </div>
              )}

              {/* New Group Tab */}
              {maintainTab === "group" && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Select Section <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedSectionForGroup}
                      onChange={(e) => setSelectedSectionForGroup(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      disabled={maintainBusy}
                    >
                      <option value="">-- Choose section --</option>
                      {sectionList.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      New Group Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="e.g. New Subcategory"
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      disabled={maintainBusy}
                    />
                  </div>
                  <button
                    onClick={createNewGroup}
                    disabled={maintainBusy || !selectedSectionForGroup || !newGroupName.trim()}
                    className="w-full py-3 px-6 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl disabled:opacity-50 transition-colors"
                  >
                    Create New Group
                  </button>
                </div>
              )}

              {/* Move Group Tab */}
              {maintainTab === "move-group" && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Group to Move <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={groupToMove}
                      onChange={(e) => setGroupToMove(e.target.value)}
                      placeholder="Enter group name"
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      disabled={maintainBusy}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Target Section <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={targetSectionForMove}
                      onChange={(e) => setTargetSectionForMove(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      disabled={maintainBusy}
                    >
                      <option value="">-- Choose target --</option>
                      {sectionList.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={moveGroup}
                    disabled={maintainBusy || !groupToMove.trim() || !targetSectionForMove}
                    className="w-full py-3 px-6 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl disabled:opacity-50 transition-colors"
                  >
                    Move Group to New Section
                  </button>
                </div>
              )}

              {/* Rename Tab */}
              {maintainTab === "rename" && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Rename Type
                    </label>
                    <select
                      value={renameTarget}
                      onChange={(e) => {
                        setRenameTarget(e.target.value as "section" | "group");
                        setRenameOldName("");
                        setRenameNewName("");
                      }}
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      disabled={maintainBusy}
                    >
                      <option value="section">Section</option>
                      <option value="group">Group</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Current Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={renameOldName}
                      onChange={(e) => setRenameOldName(e.target.value)}
                      placeholder={`Current ${renameTarget} name`}
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      disabled={maintainBusy}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      New Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={renameNewName}
                      onChange={(e) => setRenameNewName(e.target.value)}
                      placeholder="New name"
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      disabled={maintainBusy}
                    />
                  </div>
                  <button
                    onClick={renameItem}
                    disabled={maintainBusy || !renameOldName.trim() || !renameNewName.trim()}
                    className="w-full py-3 px-6 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl disabled:opacity-50 transition-colors"
                  >
                    Rename {renameTarget === "section" ? "Section" : "Group"}
                  </button>
                </div>
              )}

              {/* Delete Group Tab */}
              {maintainTab === "delete-group" && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Section containing the group <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={deleteGroupSection}
                      onChange={(e) => setDeleteGroupSection(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      disabled={maintainBusy}
                    >
                      <option value="">-- Choose section --</option>
                      {sectionList.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Group to Delete <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={groupToDelete}
                      onChange={(e) => setGroupToDelete(e.target.value)}
                      placeholder="Group name to delete"
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      disabled={maintainBusy}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Move Items To Group (optional - leave blank for none)
                    </label>
                    <input
                      type="text"
                      value={moveToGroupAfterDelete}
                      onChange={(e) => setMoveToGroupAfterDelete(e.target.value)}
                      placeholder="Target group name"
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      disabled={maintainBusy}
                    />
                  </div>
                  <button
                    onClick={deleteGroupAndMove}
                    disabled={maintainBusy || !deleteGroupSection || !groupToDelete.trim()}
                    className="w-full py-3 px-6 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl disabled:opacity-50 transition-colors"
                  >
                    Delete Group & Move Items
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── YouTubeImportModal Component ─────────────────────────────────────
function YouTubeImportModal({
  token,
  onClose,
  onStartProgress,
  pushLog,
  allGroupOptions,
  busy,
  setBusy,
}: {
  token: string;
  onClose: () => void;
  onStartProgress: (videos: any[]) => void;
  pushLog: (line: string) => void;
  allGroupOptions: string[];
  busy: boolean;
  setBusy: (busy: boolean) => void;
}) {
  const [channels, setChannels] = useState<Array<{ url: string; group: string }>>([{ url: "", group: "" }]);
  const [fetchedVideos, setFetchedVideos] = useState<any[]>([]);
  const [fetching, setFetching] = useState(false);

  const addChannel = () => setChannels([...channels, { url: "", group: "" }]);
  const removeChannel = (index: number) => setChannels(channels.filter((_, i) => i !== index));
  const updateChannel = (index: number, field: "url" | "group", value: string) => {
    const updated = [...channels];
    updated[index][field] = value;
    setChannels(updated);
  };

  const fetchVideos = async () => {
    const validChannels = channels.filter((ch) => ch.url.trim() && ch.group.trim());
    if (validChannels.length === 0) {
      alert("Please enter at least one channel URL with a group selected");
      return;
    }
    setFetching(true);
    setBusy(true);
    setFetchedVideos([]);
    try {
      pushLog(`Fetching videos from ${validChannels.length} channel(s)...`);
      const response = await fetch("/api/admin/youtube/fetch-videos", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ channels: validChannels }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch videos");
      }
      const data = await response.json();
      setFetchedVideos(data.videos || []);
      pushLog(`✅ Fetched ${data.videos.length} total videos`);
    } catch (error: any) {
      pushLog(`❌ Error: ${error.message}`);
      alert(`Error: ${error.message}`);
    } finally {
      setFetching(false);
      setBusy(false);
    }
  };

  const startDownloading = () => {
    if (fetchedVideos.length === 0) {
      alert("No videos to download");
      return;
    }
    onStartProgress(fetchedVideos);
    downloadVideosWithProgress(fetchedVideos, token, pushLog);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-slate-900">📺 Import Latest Videos from YouTube Channel-s</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <p className="text-sm text-slate-600">
            Enter YouTube channel URLs and select a group for each. Last 5 videos from each channel will be fetched.
          </p>
          {channels.map((channel, index) => (
            <div key={index} className="flex gap-2 items-start">
              <div className="flex-1">
                <input
                  type="text"
                  value={channel.url}
                  onChange={(e) => updateChannel(index, "url", e.target.value)}
                  placeholder="https://www.youtube.com/@ChannelName"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  disabled={fetching}
                />
              </div>
              <div className="w-48">
                <select
                  value={channel.group}
                  onChange={(e) => updateChannel(index, "group", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  disabled={fetching}
                >
                  <option value="">Select Group</option>
                  {allGroupOptions.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
              </div>
              {channels.length > 1 && (
                <button
                  onClick={() => removeChannel(index)}
                  className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                  disabled={fetching}
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          <button
            onClick={addChannel}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-sm font-bold transition-colors"
            disabled={fetching}
          >
            ➕ Add Another Channel
          </button>
        </div>

        <div className="flex gap-3 mb-6">
          <button
            onClick={fetchVideos}
            disabled={fetching}
            className="flex-1 px-4 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm transition-colors"
          >
            {fetching ? "⏳ Fetching..." : "🔍 Fetch Videos"}
          </button>
        </div>

        {fetchedVideos.length > 0 && (
          <>
            <div className="mb-4">
              <h3 className="text-lg font-bold text-slate-900 mb-3">📋 Fetched Videos ({fetchedVideos.length})</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {fetchedVideos.map((video, index) => (
                  <div key={index} className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h4 className="font-bold text-sm text-slate-900 mb-1">{video.title}</h4>
                        <div className="text-xs text-slate-600 space-y-1">
                          <div>📺 Channel: {video.channelTitle}</div>
                          <div>📅 Uploaded: {video.uploadDate}</div>
                          <div>👁️ Views: {video.viewCount?.toLocaleString()}</div>
                          <div>🏷️ Group: {video.group}</div>
                        </div>
                      </div>
                      <a
                        href={video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 rounded bg-blue-500 text-white text-xs font-bold hover:bg-blue-600 transition-colors"
                      >
                        ▶️ Test
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={startDownloading}
              disabled={fetching}
              className="w-full px-4 py-3 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm transition-colors shadow-lg"
            >
              📥 Start Download & Upload Process
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── YouTube Download Progress Function ───────────────────────────────
async function downloadVideosWithProgress(videos: any[], token: string, pushLog: (line: string) => void) {
  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    try {
      pushLog(`\n📹 Video ${i + 1}/${videos.length}: ${video.title}`);
      window.dispatchEvent(
        new CustomEvent("youtube-progress", {
          detail: { index: i, status: "downloading", current: i },
        })
      );
      pushLog(` ⬇️ Downloading from YouTube...`);
      window.dispatchEvent(new CustomEvent("youtube-progress", { detail: { index: i, status: "uploading" } }));
      pushLog(` ⬆️ Uploading to S3...`);

      const response = await fetch("/api/admin/youtube/download-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ videos: [video] }),
      });

      if (!response.ok) throw new Error("Upload failed");

      const data = await response.json();
      const result = data.results[0];

      if (result.success) {
        window.dispatchEvent(new CustomEvent("youtube-progress", { detail: { index: i, status: "saving" } }));
        pushLog(` 💾 Saving to DynamoDB...`);
        window.dispatchEvent(
          new CustomEvent("youtube-progress", {
            detail: { index: i, status: "done", s3Url: result.s3Url, size: result.size || undefined },
          })
        );
        pushLog(` ✅ Complete! S3 URL: ${result.s3Url}`);
      } else {
        throw new Error(result.error || "Unknown error");
      }
    } catch (error: any) {
      pushLog(` ❌ Failed: ${error.message}`);
      window.dispatchEvent(
        new CustomEvent("youtube-progress", { detail: { index: i, status: "error", error: error.message } })
      );
    }
  }

  window.dispatchEvent(new CustomEvent("youtube-progress", { detail: { allDone: true } }));
  pushLog(`\n🎉 All videos processed!`);
}