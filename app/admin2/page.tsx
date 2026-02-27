"use client";

import { useEffect, useMemo, useState } from "react";

// ──────────────────────────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────────────────────────

type SortDir = "asc" | "desc";
type SortState = { key: string; dir: SortDir } | null;

type DynamoItem = {
  PK: string;
  url?: string;
  section?: string;
  group?: string;
  title?: string;
  person?: string;
  date?: string;
  description?: string;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
};

type ContentItem = {
  PK: string;
  type: string;
  text: string;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  color?: string;
  textAlign?: string;
  backgroundColor?: string;
  padding?: string;
  level?: number;
  sectionId?: number;
  groupId?: number;
  order?: number;
  active?: boolean;
  updatedAt?: string;
};

// ──────────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────────

const AWS_REGION =
  process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ca-central-1";

function truncate(str: any, maxLen: number = 40): string {
  const s = String(str || "");
  return s.length <= maxLen ? s : s.slice(0, maxLen) + "...";
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function rand6(): string {
  return Math.random().toString(36).slice(2, 8);
}

function makeMediaPK(): string {
  return `MEDIA#${Date.now()}#${rand6()}`;
}

function compareValues(a: any, b: any, key?: string): number {
  const aEmpty = a == null || String(a).trim() === "";
  const bEmpty = b == null || String(b).trim() === "";
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  if (key === "PK") {
    const getTS = (pk: string): number => {
      const parts = String(pk).split("#");
      if (parts.length >= 2) {
        const ts = Number(parts[1]);
        return Number.isFinite(ts) ? ts : 0;
      }
      return 0;
    };
    return getTS(a) - getTS(b);
  }

  if (typeof a === "boolean" || typeof b === "boolean") {
    return (a ? 1 : 0) - (b ? 1 : 0);
  }

  const ad = Date.parse(String(a));
  const bd = Date.parse(String(b));
  if (!isNaN(ad) && !isNaN(bd)) return ad - bd;

  const an = Number(String(a).replace(/,/g, ""));
  const bn = Number(String(b).replace(/,/g, ""));
  if (!isNaN(an) && !isNaN(bn)) return an - bn;

  return String(a).toLowerCase().localeCompare(String(b).toLowerCase());
}

function sortArray<T extends Record<string, any>>(arr: T[], sort: SortState): T[] {
  if (!sort) return arr;
  const mul = sort.dir === "asc" ? 1 : -1;
  return [...arr].sort((x, y) => mul * compareValues(x?.[sort.key], y?.[sort.key], sort.key));
}

function filterBySearch<T extends Record<string, any>>(arr: T[], query: string): T[] {
  if (!query.trim()) return arr;
  const q = query.trim().toLowerCase();
  return arr.filter((row) =>
    Object.values(row).some((v) =>
      v != null && String(v).toLowerCase().includes(q)
    )
  );
}

function SortButton({
  label,
  colKey,
  sort,
  onSort,
}: {
  label: string;
  colKey: string;
  sort: SortState;
  onSort: (key: string) => void;
}) {
  const active = sort?.key === colKey;
  const arrow = active ? (sort!.dir === "asc" ? " ▲" : " ▼") : "";
  return (
    <button
      type="button"
      onClick={() => onSort(colKey)}
      className={`text-xs font-medium uppercase ${active ? "text-gray-900" : "text-gray-500"
        } hover:text-gray-900`}
    >
      {label}
      {arrow}
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────────
// MEDIA TABLE PROPS INTERFACE (this fixes the red underline)
// ──────────────────────────────────────────────────────────────────────

interface MediaTableProps {
  items: DynamoItem[];
  loading: boolean;
  selectedPKs: Set<string>;
  deleting: boolean;
  onRefresh: () => void;
  onToggleSelect: (pk: string) => void;
  onToggleSelectAll: () => void;
  onDelete: () => void;
  onAddNew: () => void;
  onEdit: (item: DynamoItem) => void;
  sort: SortState;
  onSort: (key: string) => void;
}

// ──────────────────────────────────────────────────────────────────────
// MEDIA TABLE COMPONENT (defined BEFORE Admin2Page)
// ──────────────────────────────────────────────────────────────────────

function MediaTable({
  items,
  loading,
  selectedPKs,
  deleting,
  onRefresh,
  onToggleSelect,
  onToggleSelectAll,
  onDelete,
  onAddNew,
  onEdit,
  sort,
  onSort,
}: MediaTableProps) {
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="text-lg font-semibold text-slate-900">Media Items</h2>
        <div className="flex gap-3">
          <button
            onClick={onAddNew}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            + Add New
          </button>
          {selectedPKs.size > 0 && (
            <button
              onClick={onDelete}
              disabled={deleting}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? "Deleting..." : `Delete (${selectedPKs.size})`}
            </button>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-500">Loading media items...</div>
      ) : items.length === 0 ? (
        <div className="p-8 text-center text-slate-500">No media items found</div>
      ) : (
        <div className="overflow-x-auto scrollbar-modern">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedPKs.size === items.length && items.length > 0}
                    onChange={onToggleSelectAll}
                  />
                </th>
                <th className="px-6 py-3 text-left">
                  <SortButton label="PK" colKey="PK" sort={sort} onSort={onSort} />
                </th>
                <th className="px-6 py-3 text-left">
                  <SortButton label="Section" colKey="section" sort={sort} onSort={onSort} />
                </th>
                <th className="px-6 py-3 text-left">
                  <SortButton label="Group" colKey="group" sort={sort} onSort={onSort} />
                </th>
                <th className="px-6 py-3 text-left">
                  <SortButton label="Title" colKey="title" sort={sort} onSort={onSort} />
                </th>
                <th className="px-6 py-3 text-left">
                  <SortButton label="Person" colKey="person" sort={sort} onSort={onSort} />
                </th>
                <th className="px-6 py-3 text-left">
                  <SortButton label="Date" colKey="date" sort={sort} onSort={onSort} />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.map((item) => (
                <tr key={item.PK} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedPKs.has(item.PK)}
                      onChange={() => onToggleSelect(item.PK)}
                    />
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-900 truncate max-w-xs">
                    {item.PK}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {item.section || "-"}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {item.group || "-"}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-900">
                    {item.title || "-"}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {item.person || "-"}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {item.date || "-"}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <button
                      onClick={() => onEdit(item)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-6 py-3 text-xs text-slate-500">
            Tip: click headers to sort (click again to reverse).
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// MEDIA EDITOR (kept almost unchanged)
// ──────────────────────────────────────────────────────────────────────

function MediaEditor({
  item,
  onSave,
  onCancel,
  saving,
  existingItems,
}: {
  item: DynamoItem | null;
  onSave: (item: DynamoItem) => void;
  onCancel: () => void;
  saving: boolean;
  existingItems: DynamoItem[];
}) {
  const existingSections = useMemo(() => {
    const s = new Set<string>();
    for (const it of existingItems) {
      if (it.section) s.add(it.section);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [existingItems]);

  const existingGroups = useMemo(() => {
    const s = new Set<string>();
    for (const it of existingItems) {
      if (it.group) s.add(it.group);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [existingItems]);

  const [formData, setFormData] = useState<DynamoItem>(() => {
    if (item) return { ...item };
    const now = new Date().toISOString();
    return {
      PK: makeMediaPK(),
      url: "",
      section: existingSections[0] || "Live Videos",
      group: "",
      title: "",
      person: "",
      date: "",
      description: "",
      active: true,
      createdAt: now,
      updatedAt: now,
    };
  });

  useEffect(() => {
    if (!item) return;
    setFormData({ ...item });
  }, [item]);

  const regeneratePK = () => {
    if (item) return;
    setFormData((p) => ({ ...p, PK: makeMediaPK() }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.section || !String(formData.section).trim()) {
      alert("Section is required.");
      return;
    }
    const now = new Date().toISOString();
    const payload: DynamoItem = {
      ...formData,
      PK: String(formData.PK).trim(),
      section: String(formData.section || "").trim(),
      group: String(formData.group || "").trim() || undefined,
      url: String(formData.url || "").trim() || undefined,
      title: String(formData.title || "").trim() || undefined,
      person: String(formData.person || "").trim() || undefined,
      date: String(formData.date || "").trim() || undefined,
      description: String(formData.description || "").trim() || undefined,
      active: !!formData.active,
      updatedAt: now,
      createdAt: item?.createdAt || formData.createdAt || now,
    };
    onSave(payload);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">
            {item ? "Edit Media Item" : "Add New Media Item"}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-500 hover:text-slate-800"
            title="Close"
          >
            ✕
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {/* PK */}
          <div>
            <label className="block text-sm font-medium mb-1">PK</label>
            <div className="flex gap-2">
              <input
                value={formData.PK}
                readOnly
                className="flex-1 border rounded px-3 py-2 bg-slate-50 font-mono text-sm"
              />
              {!item && (
                <button
                  type="button"
                  onClick={regeneratePK}
                  className="px-3 py-2 bg-slate-200 rounded hover:bg-slate-300"
                >
                  Regenerate
                </button>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Auto-generated: <span className="font-mono">MEDIA#timestamp#rand</span>
            </div>
          </div>
          {/* Section */}
          <div>
            <label className="block text-sm font-medium mb-1">Section *</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <select
                value={formData.section || ""}
                onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                className="w-full border rounded px-3 py-2"
              >
                {existingSections.length === 0 ? (
                  <option value="Live Videos">Live Videos</option>
                ) : (
                  existingSections.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))
                )}
              </select>
              <input
                placeholder="Or type a new section..."
                value={formData.section || ""}
                onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>
          {/* Group */}
          <div>
            <label className="block text-sm font-medium mb-1">Group</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <select
                value={formData.group || ""}
                onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">(none)</option>
                {existingGroups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <input
                placeholder="Or type a new group..."
                value={formData.group || ""}
                onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>
          {/* URL */}
          <div>
            <label className="block text-sm font-medium mb-1">URL</label>
            <input
              value={formData.url || ""}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              className="w-full border rounded px-3 py-2"
              placeholder="https://..."
            />
          </div>
          {/* Title / Person / Date */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input
                value={formData.title || ""}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="Title shown to users"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Person</label>
              <input
                value={formData.person || ""}
                onChange={(e) => setFormData({ ...formData, person: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="Creator / channel / speaker"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date</label>
              <input
                value={formData.date || ""}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="YYYY-MM-DD (or any text)"
              />
            </div>
          </div>
          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border rounded px-3 py-2 min-h-[80px]"
              placeholder="Optional"
            />
          </div>
          {/* Active */}
          <div className="flex items-center gap-2">
            <input
              id="active"
              type="checkbox"
              checked={!!formData.active}
              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
            />
            <label htmlFor="active" className="text-sm font-medium">
              Active
            </label>
          </div>
          {/* Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-300 py-2 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
          <div className="text-xs text-slate-500">
            Saved fields: PK, section, group, url, title, person, date, description, active, createdAt, updatedAt.
          </div>
        </form>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// MAIN ADMIN2 PAGE
// ──────────────────────────────────────────────────────────────────────

export default function Admin2Page() {
  const [activeTab, setActiveTab] = useState<"media" | "content">("media");
  const [token, setToken] = useState("");
  const [authenticated, setAuthenticated] = useState(false);

  const [mediaItems, setMediaItems] = useState<DynamoItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [selectedMediaPKs, setSelectedMediaPKs] = useState<Set<string>>(new Set());
  const [mediaDeleting, setMediaDeleting] = useState(false);

  const [showAddMediaForm, setShowAddMediaForm] = useState(false);
  const [editingMedia, setEditingMedia] = useState<DynamoItem | null>(null);
  const [mediaSaving, setMediaSaving] = useState(false);

  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [contentLoading, setContentLoading] = useState(true);
  const [selectedContentPKs, setSelectedContentPKs] = useState<Set<string>>(new Set());
  const [contentDeleting, setContentDeleting] = useState(false);
  const [editingContent, setEditingContent] = useState<ContentItem | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const [mediaSort, setMediaSort] = useState<SortState>({ key: "PK", dir: "desc" });
  const [contentSort, setContentSort] = useState<SortState>({ key: "PK", dir: "desc" });

  const [globalSearch, setGlobalSearch] = useState("");

  const [error, setError] = useState("");

  const toggleMediaSort = (key: string) => {
    setMediaSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  };

  const toggleContentSort = (key: string) => {
    setContentSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  };

  const mediaItemsSorted = useMemo(() => sortArray(mediaItems, mediaSort), [mediaItems, mediaSort]);
  const contentItemsSorted = useMemo(() => sortArray(contentItems, contentSort), [contentItems, contentSort]);

  const mediaItemsFiltered = useMemo(() => filterBySearch(mediaItemsSorted, globalSearch), [mediaItemsSorted, globalSearch]);
  const contentItemsFiltered = useMemo(() => filterBySearch(contentItemsSorted, globalSearch), [contentItemsSorted, globalSearch]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/list-all", {
        headers: { "x-admin-token": token },
      });
      if (res.ok) {
        setAuthenticated(true);
        loadMediaData(token);
        loadContentData(token);
      } else {
        setError("Invalid admin token");
      }
    } catch {
      setError("Failed to authenticate");
    }
  };

  const loadMediaData = async (adminToken: string) => {
    try {
      setMediaLoading(true);
      const res = await fetch("/api/admin/list-all", {
        headers: { "x-admin-token": adminToken },
      });
      if (!res.ok) throw new Error("Failed to load media data");
      const data = await res.json();
      setMediaItems(data.items || []);
      setSelectedMediaPKs(new Set());
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to load media data");
    } finally {
      setMediaLoading(false);
    }
  };

  const loadContentData = async (adminToken: string) => {
    try {
      setContentLoading(true);
      const res = await fetch("/api/admin/content", {
        headers: { "x-admin-token": adminToken },
      });
      if (!res.ok) throw new Error("Failed to load content data");
      const data = await res.json();
      setContentItems(data.items || []);
      setSelectedContentPKs(new Set());
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to load content data");
    } finally {
      setContentLoading(false);
    }
  };

  const toggleMediaSelect = (pk: string) => {
    setSelectedMediaPKs((prev) => {
      const next = new Set(prev);
      if (next.has(pk)) next.delete(pk);
      else next.add(pk);
      return next;
    });
  };

  const toggleMediaSelectAll = () => {
    const shownPKs = mediaItemsSorted.map((it) => it.PK);
    if (selectedMediaPKs.size === shownPKs.length) {
      setSelectedMediaPKs(new Set());
    } else {
      setSelectedMediaPKs(new Set(shownPKs));
    }
  };

  const handleDeleteMedia = async () => {
    if (selectedMediaPKs.size === 0) {
      setError("No items selected");
      return;
    }
    const confirmed = window.confirm(
      `Delete ${selectedMediaPKs.size} media item(s)? This cannot be undone.`
    );
    if (!confirmed) return;
    try {
      setMediaDeleting(true);
      setError("");
      const res = await fetch("/api/admin/list-all", {
        method: "DELETE",
        headers: {
          "x-admin-token": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pks: Array.from(selectedMediaPKs) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      alert(`✅ Deleted ${data.deleted} item(s)`);
      await loadMediaData(token);
    } catch (err: any) {
      setError(err.message || "Failed to delete media items");
    } finally {
      setMediaDeleting(false);
    }
  };

  const handleSaveMedia = async (item: DynamoItem) => {
    try {
      setMediaSaving(true);
      setError("");
      const res = await fetch("/api/admin/list-all", {
        method: "POST",
        headers: {
          "x-admin-token": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(item),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.error || "Save failed. (Backend must support POST /api/admin/list-all)"
        );
      }
      alert("✅ Media saved");
      setShowAddMediaForm(false);
      setEditingMedia(null);
      await loadMediaData(token);
    } catch (err: any) {
      setError(err.message || "Failed to save media item");
    } finally {
      setMediaSaving(false);
    }
  };

  const toggleContentSelect = (pk: string) => {
    setSelectedContentPKs((prev) => {
      const next = new Set(prev);
      if (next.has(pk)) next.delete(pk);
      else next.add(pk);
      return next;
    });
  };

  const toggleContentSelectAll = () => {
    const shownPKs = contentItemsSorted.map((it) => it.PK);
    if (selectedContentPKs.size === shownPKs.length) {
      setSelectedContentPKs(new Set());
    } else {
      setSelectedContentPKs(new Set(shownPKs));
    }
  };

  const handleDeleteContent = async () => {
    if (selectedContentPKs.size === 0) {
      setError("No items selected");
      return;
    }
    const confirmed = window.confirm(
      `Delete ${selectedContentPKs.size} content item(s)? This cannot be undone.`
    );
    if (!confirmed) return;
    try {
      setContentDeleting(true);
      setError("");
      const res = await fetch("/api/admin/content", {
        method: "DELETE",
        headers: {
          "x-admin-token": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pks: Array.from(selectedContentPKs) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      alert(`✅ Deleted ${data.deleted} item(s)`);
      await loadContentData(token);
    } catch (err: any) {
      setError(err.message || "Failed to delete content items");
    } finally {
      setContentDeleting(false);
    }
  };

  const handleSaveContent = async (item: ContentItem) => {
    try {
      const res = await fetch("/api/admin/content", {
        method: "POST",
        headers: {
          "x-admin-token": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(item),
      });
      if (!res.ok) throw new Error("Save failed");
      alert("✅ Saved successfully");
      setEditingContent(null);
      setShowAddForm(false);
      await loadContentData(token);
    } catch (err: any) {
      setError(err.message || "Failed to save");
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-900 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
          <h1 className="text-2xl font-bold text-slate-900 mb-6">Admin Login</h1>
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-slate-700 mb-2 font-medium">Admin Token:</label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Login
            </button>
            {error && <div className="text-red-600 mt-4 text-center">{error}</div>}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 p-6">

      {/* ── Global Search ── */}
      <div className="mb-5">
        <div className="relative max-w-xl">
          <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 pointer-events-none">
            🔍
          </span>
          <input
            type="text"
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            placeholder="Search all fields across both tables…"
            className="w-full pl-9 pr-9 py-2.5 border border-slate-300 rounded-lg bg-white shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {globalSearch && (
            <button
              onClick={() => setGlobalSearch("")}
              className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        {globalSearch && (
          <p className="mt-1.5 text-xs text-slate-500">
            Showing {mediaItemsFiltered.length}/{mediaItems.length} media &amp; {contentItemsFiltered.length}/{contentItems.length} content rows matching &ldquo;{globalSearch}&rdquo;
          </p>
        )}
      </div>

      <div className="border-b border-slate-300 mb-6">
        <div className="flex space-x-1">
          <button
            onClick={() => setActiveTab("media")}
            className={`px-6 py-3 font-medium text-sm transition-all ${activeTab === "media"
                ? "border-b-4 border-blue-600 text-blue-700 bg-blue-50"
                : "text-slate-600 hover:text-slate-800 hover:bg-slate-100"
              }`}
          >
            Media Items – {AWS_REGION}{globalSearch ? ` (${mediaItemsFiltered.length}/${mediaItems.length})` : ` (${mediaItems.length})`}
          </button>
          <button
            onClick={() => setActiveTab("content")}
            className={`px-6 py-3 font-medium text-sm transition-all ${activeTab === "content"
                ? "border-b-4 border-blue-600 text-blue-700 bg-blue-50"
                : "text-slate-600 hover:text-slate-800 hover:bg-slate-100"
              }`}
          >
            Website Content – {AWS_REGION}{globalSearch ? ` (${contentItemsFiltered.length}/${contentItems.length})` : ` (${contentItems.length})`}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {activeTab === "media" && (
        <>
          {(showAddMediaForm || editingMedia) && (
            <MediaEditor
              existingItems={mediaItems}
              item={editingMedia}
              saving={mediaSaving}
              onCancel={() => {
                setShowAddMediaForm(false);
                setEditingMedia(null);
              }}
              onSave={handleSaveMedia}
            />
          )}
          <MediaTable
            items={mediaItemsFiltered}
            loading={mediaLoading}
            selectedPKs={selectedMediaPKs}
            deleting={mediaDeleting}
            onRefresh={() => loadMediaData(token)}
            onToggleSelect={toggleMediaSelect}
            onToggleSelectAll={toggleMediaSelectAll}
            onDelete={handleDeleteMedia}
            onAddNew={() => {
              setEditingMedia(null);
              setShowAddMediaForm(true);
            }}
            onEdit={(it) => {
              setShowAddMediaForm(false);
              setEditingMedia(it);
            }}
            sort={mediaSort}
            onSort={toggleMediaSort}
          />
        </>
      )}

      {activeTab === "content" && (
        <ContentTable
          items={contentItemsFiltered}
          loading={contentLoading}
          selectedPKs={selectedContentPKs}
          deleting={contentDeleting}
          editingContent={editingContent}
          showAddForm={showAddForm}
          onRefresh={() => loadContentData(token)}
          onToggleSelect={toggleContentSelect}
          onToggleSelectAll={toggleContentSelectAll}
          onDelete={handleDeleteContent}
          onEdit={setEditingContent}
          onSave={handleSaveContent}
          onCancelEdit={() => {
            setEditingContent(null);
            setShowAddForm(false);
          }}
          onShowAddForm={() => setShowAddForm(true)}
          sort={contentSort}
          onSort={toggleContentSort}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// CONTENT TABLE & EDITOR (kept as-is from your code)
// ──────────────────────────────────────────────────────────────────────

function ContentTable({
  items,
  loading,
  selectedPKs,
  deleting,
  editingContent,
  showAddForm,
  onRefresh,
  onToggleSelect,
  onToggleSelectAll,
  onDelete,
  onEdit,
  onSave,
  onCancelEdit,
  onShowAddForm,
  sort,
  onSort,
}: {
  items: ContentItem[];
  loading: boolean;
  selectedPKs: Set<string>;
  deleting: boolean;
  editingContent: ContentItem | null;
  showAddForm: boolean;
  onRefresh: () => void;
  onToggleSelect: (pk: string) => void;
  onToggleSelectAll: () => void;
  onDelete: () => void;
  onEdit: (item: ContentItem) => void;
  onSave: (item: ContentItem) => void;
  onCancelEdit: () => void;
  onShowAddForm: () => void;
  sort: SortState;
  onSort: (key: string) => void;
}) {
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="text-lg font-semibold text-slate-900">Website Content</h2>
        <div className="flex gap-3">
          <button
            onClick={onShowAddForm}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            + Add New
          </button>
          {selectedPKs.size > 0 && (
            <button
              onClick={onDelete}
              disabled={deleting}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? "Deleting..." : `Delete (${selectedPKs.size})`}
            </button>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {showAddForm && <ContentEditor item={null} onSave={onSave} onCancel={onCancelEdit} />}

      {loading ? (
        <div className="p-8 text-center text-slate-500">Loading content...</div>
      ) : items.length === 0 ? (
        <div className="p-8 text-center text-slate-500">No content items found</div>
      ) : (
        <div className="overflow-x-auto scrollbar-modern">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedPKs.size === items.length && items.length > 0}
                    onChange={onToggleSelectAll}
                  />
                </th>
                <th className="px-6 py-3 text-left">
                  <SortButton label="PK" colKey="PK" sort={sort} onSort={onSort} />
                </th>
                <th className="px-6 py-3 text-left">
                  <SortButton label="Type" colKey="type" sort={sort} onSort={onSort} />
                </th>
                <th className="px-6 py-3 text-left">
                  <SortButton label="Text" colKey="text" sort={sort} onSort={onSort} />
                </th>
                <th className="px-6 py-3 text-left">
                  <SortButton label="Active" colKey="active" sort={sort} onSort={onSort} />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.map((item) => (
                <tr key={item.PK} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedPKs.has(item.PK)}
                      onChange={() => onToggleSelect(item.PK)}
                    />
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-900 truncate max-w-xs">
                    {item.PK}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{item.type}</td>
                  <td className="px-6 py-4 text-sm text-slate-900 truncate max-w-md">
                    {item.text}
                  </td>
                  <td className="px-6 py-4 text-sm">{item.active ? "✅" : "❌"}</td>
                  <td className="px-6 py-4 text-sm">
                    <button
                      onClick={() => onEdit(item)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-6 py-3 text-xs text-slate-500">
            Tip: click headers to sort (click again to reverse).
          </div>
        </div>
      )}

      {editingContent && (
        <ContentEditor item={editingContent} onSave={onSave} onCancel={onCancelEdit} />
      )}
    </div>
  );
}

function ContentEditor({
  item,
  onSave,
  onCancel,
}: {
  item: ContentItem | null;
  onSave: (item: ContentItem) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<ContentItem>(
    item || {
      PK: "",
      type: "header",
      text: "",
      fontFamily: "Arial, sans-serif",
      fontSize: "16px",
      fontWeight: "normal",
      color: "#000000",
      textAlign: "left",
      backgroundColor: "transparent",
      padding: "0px",
      order: 0,
      active: true,
    }
  );

  useEffect(() => {
    if (item) setFormData(item);
  }, [item]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-4">
          {item ? "Edit Content" : "Add New Content"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              PK (e.g., HEADER#1, SECTION#1, GROUP#1#1, FOOTER#1):
            </label>
            <input
              type="text"
              value={formData.PK}
              onChange={(e) => setFormData({ ...formData, PK: e.target.value })}
              className="w-full border rounded px-3 py-2"
              required
              disabled={!!item}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Type:</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full border rounded px-3 py-2"
              required
            >
              <option value="header">Header</option>
              <option value="section_header">Section Header</option>
              <option value="group_title">Group Title</option>
              <option value="footer">Footer</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Text:</label>
            <textarea
              value={formData.text}
              onChange={(e) => setFormData({ ...formData, text: e.target.value })}
              className="w-full border rounded px-3 py-2 min-h-[80px]"
              required
            />
          </div>
          <div className="flex gap-3 mt-6">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            >
              Save
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-300 py-2 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}