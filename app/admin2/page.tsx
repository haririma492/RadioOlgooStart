"use client";

import { useEffect, useState, useRef } from "react";

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

  // Login form
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-900" style={{ padding: "40px", maxWidth: "400px", margin: "0 auto" }}>
        <h1 className="text-2xl font-bold text-slate-900">Admin Login</h1>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: "16px" }}>
            <label className="block text-slate-700 mb-2 font-medium">
              Admin Token:
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full px-3 py-2 text-slate-900 bg-white border border-slate-300 rounded"
              required
            />
          </div>
          <button type="submit" style={buttonStyle}>
            Login
          </button>
          {error && <div className="text-red-600 mt-4">{error}</div>}
        </form>
      </div>
    );
  }

  // Main view with tabs — use light bg and dark text so content is visible (body has color:white globally)
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900" style={{ padding: "20px" }}>
      {/* Tabs */}
      <div style={{ borderBottom: "2px solid #ddd", marginBottom: "20px" }}>
        <button
          onClick={() => setActiveTab("media")}
          style={{
            ...tabButtonStyle,
            borderBottom: activeTab === "media" ? "3px solid #0070f3" : "none",
            color: activeTab === "media" ? "#0070f3" : "#374151",
          }}
        >
          Media Items ({mediaItems.length})
        </button>
        <button
          onClick={() => setActiveTab("content")}
          style={{
            ...tabButtonStyle,
            borderBottom: activeTab === "content" ? "3px solid #0070f3" : "none",
            color: activeTab === "content" ? "#0070f3" : "#374151",
          }}
        >
          Website Content ({contentItems.length})
        </button>
      </div>

      {error && (
        <div style={{ padding: "12px", background: "#fee", color: "red", borderRadius: "4px", marginBottom: "20px" }}>
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

// Media Table Component
function MediaTable({
  items,
  loading,
  selectedPKs,
  deleting,
  onRefresh,
  onToggleSelect,
  onToggleSelectAll,
  onDelete,
}: any) {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    checkbox: 50,
    PK: 200,
    section: 150,
    group: 120,
    title: 200,
    person: 120,
    date: 100,
    description: 250,
    url: 80,
    active: 80,
    createdAt: 150,
    updatedAt: 150,
  });

  return (
    <div className="text-slate-900">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
        <h2 className="text-xl font-bold text-slate-900">Media Items</h2>
        <div style={{ display: "flex", gap: "10px" }}>
          {selectedPKs.size > 0 && (
            <button onClick={onDelete} disabled={deleting} style={{ ...buttonStyle, background: "#dc2626" }}>
              {deleting ? "Deleting..." : `Delete Selected (${selectedPKs.size})`}
            </button>
          )}
          <button onClick={onRefresh} disabled={loading} style={buttonStyle}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <ResizableTable
          columns={[
            { key: "checkbox", label: "", width: columnWidths.checkbox },
            { key: "PK", label: "PK", width: columnWidths.PK },
            { key: "section", label: "Section", width: columnWidths.section },
            { key: "group", label: "Group", width: columnWidths.group },
            { key: "title", label: "Title", width: columnWidths.title },
            { key: "person", label: "Person", width: columnWidths.person },
            { key: "date", label: "Date", width: columnWidths.date },
            { key: "description", label: "Description", width: columnWidths.description },
            { key: "url", label: "URL", width: columnWidths.url },
            { key: "active", label: "Active", width: columnWidths.active },
            { key: "createdAt", label: "Created", width: columnWidths.createdAt },
            { key: "updatedAt", label: "Updated", width: columnWidths.updatedAt },
          ]}
          data={items}
          selectedPKs={selectedPKs}
          onToggleSelect={onToggleSelect}
          onToggleSelectAll={onToggleSelectAll}
          onColumnResize={(key, width) => setColumnWidths((prev) => ({ ...prev, [key]: width }))}
          renderCell={(item, column) => {
            if (column.key === "checkbox") {
              return (
                <input
                  type="checkbox"
                  checked={selectedPKs.has(item.PK)}
                  onChange={() => onToggleSelect(item.PK)}
                  style={{ cursor: "pointer" }}
                />
              );
            }
            if (column.key === "url") {
              return item.url ? (
                <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: "#0070f3" }}>
                  Link
                </a>
              ) : (
                "-"
              );
            }
            if (column.key === "active") {
              return item.active === false ? "❌" : "✅";
            }
            if (column.key === "createdAt" || column.key === "updatedAt") {
              return formatDate(item[column.key]);
            }
            return truncate(item[column.key], 30);
          }}
        />
      )}
    </div>
  );
}

// Content Table Component
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
}: any) {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    checkbox: 50,
    PK: 150,
    type: 120,
    text: 300,
    fontFamily: 150,
    fontSize: 80,
    fontWeight: 100,
    color: 100,
    textAlign: 100,
    backgroundColor: 120,
    active: 80,
  });

  return (
    <div className="text-slate-900">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
        <h2 className="text-xl font-bold text-slate-900">Website Content</h2>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={onShowAddForm} style={{ ...buttonStyle, background: "#16a34a" }}>
            + Add New
          </button>
          {selectedPKs.size > 0 && (
            <button onClick={onDelete} disabled={deleting} style={{ ...buttonStyle, background: "#dc2626" }}>
              {deleting ? "Deleting..." : `Delete Selected (${selectedPKs.size})`}
            </button>
          )}
          <button onClick={onRefresh} disabled={loading} style={buttonStyle}>
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
        <div className="text-slate-700">Loading...</div>
      ) : (
        <ResizableTable
          columns={[
            { key: "checkbox", label: "", width: columnWidths.checkbox },
            { key: "PK", label: "PK", width: columnWidths.PK },
            { key: "type", label: "Type", width: columnWidths.type },
            { key: "text", label: "Text", width: columnWidths.text },
            { key: "fontFamily", label: "Font", width: columnWidths.fontFamily },
            { key: "fontSize", label: "Size", width: columnWidths.fontSize },
            { key: "fontWeight", label: "Weight", width: columnWidths.fontWeight },
            { key: "color", label: "Color", width: columnWidths.color },
            { key: "textAlign", label: "Align", width: columnWidths.textAlign },
            { key: "backgroundColor", label: "BG Color", width: columnWidths.backgroundColor },
            { key: "active", label: "Active", width: columnWidths.active },
            { key: "actions", label: "Actions", width: 100 },
          ]}
          data={items}
          selectedPKs={selectedPKs}
          onToggleSelect={onToggleSelect}
          onToggleSelectAll={onToggleSelectAll}
          onColumnResize={(key, width) => setColumnWidths((prev) => ({ ...prev, [key]: width }))}
          renderCell={(item, column) => {
            if (column.key === "checkbox") {
              return (
                <input
                  type="checkbox"
                  checked={selectedPKs.has(item.PK)}
                  onChange={() => onToggleSelect(item.PK)}
                  style={{ cursor: "pointer" }}
                />
              );
            }
            if (column.key === "active") {
              return item.active === false ? "❌" : "✅";
            }
            if (column.key === "color" || column.key === "backgroundColor") {
              return (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div
                    style={{
                      width: "20px",
                      height: "20px",
                      background: item[column.key] || "transparent",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                    }}
                  />
                  <span style={{ fontSize: "11px", color: "#000" }}>{item[column.key]}</span>
                </div>
              );
            }
            if (column.key === "actions") {
              return (
                <button
                  onClick={() => onEdit(item)}
                  style={{
                    padding: "4px 8px",
                    background: "#0070f3",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  Edit
                </button>
              );
            }
            return truncate(item[column.key], 30);
          }}
          editingItem={editingContent}
          onSaveEdit={onSave}
          onCancelEdit={onCancelEdit}
        />
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

// Content Editor Modal
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
    <div style={modalOverlayStyle}>
      <div style={modalStyle}>
        <h3 className="text-lg font-bold text-slate-900">{item ? "Edit Content" : "Add New Content"}</h3>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }} className="text-slate-900">
          <div>
            <label className="block text-slate-700 font-medium mb-1">PK (e.g., HEADER#1, SECTION#1, GROUP#1#1, FOOTER#1):</label>
            <input
              type="text"
              value={formData.PK}
              onChange={(e) => setFormData({ ...formData, PK: e.target.value })}
              style={{ ...inputStyle, color: "#0f172a", background: "#fff" }}
              required
              disabled={!!item}
            />
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Type:</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              style={inputStyle}
              required
            >
              <option value="header">Header</option>
              <option value="section_header">Section Header</option>
              <option value="group_title">Group Title</option>
              <option value="footer">Footer</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Text:</label>
            <textarea
              value={formData.text}
              onChange={(e) => setFormData({ ...formData, text: e.target.value })}
              style={{ ...inputStyle, minHeight: "80px" }}
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Font Family:</label>
              <input
                type="text"
                value={formData.fontFamily}
                onChange={(e) => setFormData({ ...formData, fontFamily: e.target.value })}
                style={inputStyle}
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Font Size:</label>
              <input
                type="text"
                value={formData.fontSize}
                onChange={(e) => setFormData({ ...formData, fontSize: e.target.value })}
                style={inputStyle}
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Font Weight:</label>
              <select
                value={formData.fontWeight}
                onChange={(e) => setFormData({ ...formData, fontWeight: e.target.value })}
                style={inputStyle}
              >
                <option value="normal">Normal</option>
                <option value="bold">Bold</option>
                <option value="600">Semi-bold (600)</option>
                <option value="300">Light (300)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Text Color:</label>
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                style={{ ...inputStyle, height: "40px" }}
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Text Align:</label>
              <select
                value={formData.textAlign}
                onChange={(e) => setFormData({ ...formData, textAlign: e.target.value })}
                style={inputStyle}
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Background Color:</label>
              <input
                type="color"
                value={formData.backgroundColor === "transparent" ? "#ffffff" : formData.backgroundColor}
                onChange={(e) => setFormData({ ...formData, backgroundColor: e.target.value })}
                style={{ ...inputStyle, height: "40px" }}
              />
            </div>
          </div>

          <div>
            <label className="text-slate-700">
              <input
                type="checkbox"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              />
              {" "}Active
            </label>
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
            <button type="submit" style={{ ...buttonStyle, flex: 1 }}>
              Save
            </button>
            <button type="button" onClick={onCancel} style={{ ...buttonStyle, flex: 1, background: "#666" }}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Resizable Table Component
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
    <div className="text-slate-900" style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", fontSize: "13px", color: "#111827" }}>
        <thead>
          <tr style={{ background: "#f1f5f9" }}>
            {columns.map((col: any) => (
              <th
                key={col.key}
                style={{
                  ...thStyle,
                  width: col.width,
                  minWidth: col.width,
                  maxWidth: col.width,
                  position: "relative",
                  color: "#0f172a",
                }}
              >
                {col.key === "checkbox" ? (
                  <input
                    type="checkbox"
                    checked={selectedPKs.size === data.length && data.length > 0}
                    onChange={onToggleSelectAll}
                    style={{ cursor: "pointer" }}
                  />
                ) : (
                  col.label
                )}
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
            <tr
              key={item.PK || idx}
              style={{
                borderBottom: "1px solid #e2e8f0",
                background: selectedPKs.has(item.PK) ? "#e0f2fe" : idx % 2 === 0 ? "#ffffff" : "#f8fafc",
                color: "#0f172a",
              }}
            >
              {columns.map((col: any) => (
                <td
                  key={col.key}
                  style={{
                    ...tdStyle,
                    width: col.width,
                    minWidth: col.width,
                    maxWidth: col.width,
                    color: "#0f172a",
                  }}
                >
                  {renderCell(item, col)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {data.length === 0 && (
        <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }} className="text-slate-600">
          No items found
        </div>
      )}
    </div>
  );
}

// Styles
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

const thStyle: React.CSSProperties = {
  padding: "12px 8px",
  borderBottom: "2px solid #e2e8f0",
  fontWeight: "600",
  textAlign: "left",
  position: "sticky",
  top: 0,
  background: "#f1f5f9",
  color: "#0f172a",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 8px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "#0f172a",
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  background: "white",
  padding: "24px",
  borderRadius: "8px",
  maxWidth: "600px",
  width: "90%",
  maxHeight: "90vh",
  overflow: "auto",
  color: "#0f172a",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px",
  border: "1px solid #cbd5e1",
  borderRadius: "4px",
  fontSize: "14px",
  color: "#0f172a",
  background: "#ffffff",
};

// Helpers
function truncate(str: any, maxLen: number): string {
  const s = String(str || "");
  if (!s || s === "undefined") return "-";
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