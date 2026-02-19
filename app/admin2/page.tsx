"use client";

import { useEffect, useState, useRef } from "react";

// ── Types ──────────────────────────────────────────────────────────────
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

// ── AWS Region (shown on tabs) ────────────────────────────────────────
const AWS_REGION = process.env.AWS_REGION ||
                   process.env.AWS_DEFAULT_REGION ||
                   "ca-central-1"; // fallback to your main region

// ── Shared Styles ──────────────────────────────────────────────────────
const buttonStyle: React.CSSProperties = {
  padding: "8px 16px",
  background: "#0070f3",
  color: "white",
  border: "none",
  borderRadius: "4px",
  cursor: "pointer",
  fontWeight: "600",
  fontSize: "14px",
};

const tabButtonStyle: React.CSSProperties = {
  padding: "12px 24px",
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: "16px",
  fontWeight: "600",
  marginRight: "8px",
};

export default function Admin2Page() {
  const [activeTab, setActiveTab] = useState<"media" | "content">("media");
  const [token, setToken] = useState("");
  const [authenticated, setAuthenticated] = useState(false);

  // Media table state
  const [mediaItems, setMediaItems] = useState<DynamoItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [selectedMediaPKs, setSelectedMediaPKs] = useState<Set<string>>(new Set());
  const [mediaDeleting, setMediaDeleting] = useState(false);

  // Content table state
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [contentLoading, setContentLoading] = useState(true);
  const [selectedContentPKs, setSelectedContentPKs] = useState<Set<string>>(new Set());
  const [contentDeleting, setContentDeleting] = useState(false);
  const [editingContent, setEditingContent] = useState<ContentItem | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const [error, setError] = useState("");

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
    } catch (err) {
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
    if (selectedMediaPKs.size === mediaItems.length) {
      setSelectedMediaPKs(new Set());
    } else {
      setSelectedMediaPKs(new Set(mediaItems.map((item) => item.PK)));
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

  const toggleContentSelect = (pk: string) => {
    setSelectedContentPKs((prev) => {
      const next = new Set(prev);
      if (next.has(pk)) next.delete(pk);
      else next.add(pk);
      return next;
    });
  };

  const toggleContentSelectAll = () => {
    if (selectedContentPKs.size === contentItems.length) {
      setSelectedContentPKs(new Set());
    } else {
      setSelectedContentPKs(new Set(contentItems.map((item) => item.PK)));
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

  // ── Login Form ──────────────────────────────────────────────────────
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-900 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
          <h1 className="text-2xl font-bold text-slate-900 mb-6">Admin Login</h1>
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-slate-700 mb-2 font-medium">
                Admin Token:
              </label>
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

  // ── Main Admin Interface ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 p-6">
      {/* Tabs with table names + AWS region */}
      <div className="border-b border-slate-300 mb-6">
        <div className="flex space-x-1">
          <button
            onClick={() => setActiveTab("media")}
            className={`px-6 py-3 font-medium text-sm transition-all ${
              activeTab === "media"
                ? "border-b-4 border-blue-600 text-blue-700 bg-blue-50"
                : "text-slate-600 hover:text-slate-800 hover:bg-slate-100"
            }`}
          >
            Media Items Table – Region: {AWS_REGION} ({mediaItems.length})
          </button>
          <button
            onClick={() => setActiveTab("content")}
            className={`px-6 py-3 font-medium text-sm transition-all ${
              activeTab === "content"
                ? "border-b-4 border-blue-600 text-blue-700 bg-blue-50"
                : "text-slate-600 hover:text-slate-800 hover:bg-slate-100"
            }`}
          >
            Website Content Table – Region: {AWS_REGION} ({contentItems.length})
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Media Table */}
      {activeTab === "media" && (
        <MediaTable
          items={mediaItems}
          loading={mediaLoading}
          selectedPKs={selectedMediaPKs}
          deleting={mediaDeleting}
          onRefresh={() => loadMediaData(token)}
          onToggleSelect={toggleMediaSelect}
          onToggleSelectAll={toggleMediaSelectAll}
          onDelete={handleDeleteMedia}
        />
      )}

      {/* Content Table */}
      {activeTab === "content" && (
        <ContentTable
          items={contentItems}
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
        />
      )}
    </div>
  );
}

// ── Media Table Component ────────────────────────────────────────────
function MediaTable({
  items,
  loading,
  selectedPKs,
  deleting,
  onRefresh,
  onToggleSelect,
  onToggleSelectAll,
  onDelete,
}: {
  items: DynamoItem[];
  loading: boolean;
  selectedPKs: Set<string>;
  deleting: boolean;
  onRefresh: () => void;
  onToggleSelect: (pk: string) => void;
  onToggleSelectAll: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="text-lg font-semibold text-slate-900">Media Items</h2>
        <div className="flex gap-3">
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
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">PK</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Section</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Group</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Person</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
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
                  <td className="px-6 py-4 text-sm text-slate-900 truncate max-w-xs">{item.PK}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{item.section || "-"}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{item.group || "-"}</td>
                  <td className="px-6 py-4 text-sm text-slate-900">{item.title || "-"}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{item.person || "-"}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{item.date || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Content Table Component ──────────────────────────────────────────
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

      {showAddForm && (
        <ContentEditor
          item={null}
          onSave={onSave}
          onCancel={onCancelEdit}
        />
      )}

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
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">PK</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Text</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Active</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
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
                  <td className="px-6 py-4 text-sm text-slate-900 truncate max-w-xs">{item.PK}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{item.type}</td>
                  <td className="px-6 py-4 text-sm text-slate-900 truncate max-w-md">{item.text}</td>
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
        </div>
      )}

      {editingContent && (
        <ContentEditor
          item={editingContent}
          onSave={onSave}
          onCancel={onCancelEdit}
        />
      )}
    </div>
  );
}

// ── Content Editor Modal ─────────────────────────────────────────────
function ContentEditor({ item, onSave, onCancel }: { item: ContentItem | null; onSave: (item: ContentItem) => void; onCancel: () => void }) {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-4">{item ? "Edit Content" : "Add New Content"}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">PK (e.g., HEADER#1, SECTION#1, GROUP#1#1, FOOTER#1):</label>
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

          {/* ... rest of your form fields (font, color, etc.) ... */}

          <div className="flex gap-3 mt-6">
            <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
              Save
            </button>
            <button type="button" onClick={onCancel} className="flex-1 bg-gray-300 py-2 rounded hover:bg-gray-400">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Resizable Table Component (your original, unchanged) ─────────────
function ResizableTable({
  columns,
  data,
  selectedPKs,
  onToggleSelect,
  onToggleSelectAll,
  onColumnResize,
  renderCell,
  editingItem,
  onSaveEdit,
  onCancelEdit,
}: any) {
  const [resizing, setResizing] = useState<string | null>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseDown = (key: string, width: number, e: React.MouseEvent) => {
    setResizing(key);
    startX.current = e.clientX;
    startWidth.current = width;
  };

  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startX.current;
      const newWidth = Math.max(50, startWidth.current + diff);
      onColumnResize(resizing, newWidth);
    };

    const handleMouseUp = () => {
      setResizing(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizing, onColumnResize]);

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            {columns.map((col: any) => (
              <th
                key={col.key}
                style={{
                  width: col.width,
                  minWidth: col.width,
                  padding: "12px 8px",
                  textAlign: "left",
                  background: "#f1f5f9",
                  fontWeight: "600",
                  position: "relative",
                }}
              >
                {col.label}
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: "5px",
                    cursor: "col-resize",
                    background: resizing === col.key ? "#0070f3" : "transparent",
                  }}
                  onMouseDown={(e) => handleMouseDown(col.key, col.width, e)}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item: any, idx: number) => (
            <tr key={item.PK || idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
              {columns.map((col: any) => (
                <td key={col.key} style={{ padding: "10px 8px" }}>
                  {renderCell(item, col)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Helpers (your original) ─────────────────────────────────────────
function truncate(str: any, maxLen: number): string {
  const s = String(str || "");
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen) + "...";
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