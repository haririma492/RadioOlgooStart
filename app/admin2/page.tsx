"use client";

import { useEffect, useState } from "react";

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
  [key: string]: any; // For any other fields
};

export default function Admin2Page() {
  const [items, setItems] = useState<DynamoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [selectedPKs, setSelectedPKs] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const res = await fetch("/api/admin/list-all", {
        headers: { "x-admin-token": token },
      });

      if (res.ok) {
        setAuthenticated(true);
        loadData(token);
      } else {
        setError("Invalid admin token");
      }
    } catch (err) {
      setError("Failed to authenticate");
    }
  };

  const loadData = async (adminToken: string) => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/list-all", {
        headers: { "x-admin-token": adminToken },
      });

      if (!res.ok) {
        throw new Error("Failed to load data");
      }

      const data = await res.json();
      setItems(data.items || []);
      setSelectedPKs(new Set()); // Clear selection on reload
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (pk: string) => {
    setSelectedPKs((prev) => {
      const next = new Set(prev);
      if (next.has(pk)) {
        next.delete(pk);
      } else {
        next.add(pk);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedPKs.size === items.length) {
      setSelectedPKs(new Set()); // Deselect all
    } else {
      setSelectedPKs(new Set(items.map((item) => item.PK))); // Select all
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedPKs.size === 0) {
      setError("No items selected");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedPKs.size} item(s)? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setDeleting(true);
      setError("");

      const res = await fetch("/api/admin/list-all", {
        method: "DELETE",
        headers: {
          "x-admin-token": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pks: Array.from(selectedPKs) }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Delete failed");
      }

      // Show success message
      alert(`✅ Deleted ${data.deleted} item(s)${data.failed > 0 ? `, ${data.failed} failed` : ""}`);

      // Reload data
      await loadData(token);
    } catch (err: any) {
      setError(err.message || "Failed to delete items");
    } finally {
      setDeleting(false);
    }
  };

  // Login form
  if (!authenticated) {
    return (
      <div style={{ padding: "40px", maxWidth: "400px", margin: "0 auto" }}>
        <h1>Admin Login</h1>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "8px" }}>
              Admin Token:
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                fontSize: "14px",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
              required
            />
          </div>
          <button
            type="submit"
            style={{
              padding: "10px 20px",
              background: "#0070f3",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Login
          </button>
          {error && (
            <div style={{ color: "red", marginTop: "16px" }}>{error}</div>
          )}
        </form>
      </div>
    );
  }

  // Main table view
  return (
    <div style={{ padding: "20px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <h1>DynamoDB Items ({items.length} total)</h1>
        <div style={{ display: "flex", gap: "10px" }}>
          {selectedPKs.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              disabled={deleting}
              style={{
                padding: "8px 16px",
                background: "#dc2626",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: deleting ? "not-allowed" : "pointer",
                fontWeight: "600",
              }}
            >
              {deleting ? "Deleting..." : `Delete Selected (${selectedPKs.size})`}
            </button>
          )}
          <button
            onClick={() => loadData(token)}
            disabled={loading}
            style={{
              padding: "8px 16px",
              background: "#0070f3",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: "12px",
            background: "#fee",
            color: "red",
            borderRadius: "4px",
            marginBottom: "20px",
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "13px",
            }}
          >
            <thead>
              <tr style={{ background: "#f5f5f5", textAlign: "left" }}>
                <th style={thStyle}>
                  <input
                    type="checkbox"
                    checked={selectedPKs.size === items.length && items.length > 0}
                    onChange={toggleSelectAll}
                    style={{ cursor: "pointer" }}
                  />
                </th>
                <th style={thStyle}>PK</th>
                <th style={thStyle}>Section</th>
                <th style={thStyle}>Group</th>
                <th style={thStyle}>Title</th>
                <th style={thStyle}>Person</th>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Description</th>
                <th style={thStyle}>URL</th>
                <th style={thStyle}>Active</th>
                <th style={thStyle}>Created</th>
                <th style={thStyle}>Updated</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr
                  key={item.PK || idx}
                  style={{
                    borderBottom: "1px solid #ddd",
                    background: selectedPKs.has(item.PK)
                      ? "#e0f2fe"
                      : idx % 2 === 0
                      ? "white"
                      : "#fafafa",
                  }}
                >
                  <td style={tdStyle}>
                    <input
                      type="checkbox"
                      checked={selectedPKs.has(item.PK)}
                      onChange={() => toggleSelect(item.PK)}
                      style={{ cursor: "pointer" }}
                    />
                  </td>
                  <td style={tdStyle} title={item.PK}>
                    {truncate(item.PK, 20)}
                  </td>
                  <td style={tdStyle}>{item.section || "-"}</td>
                  <td style={tdStyle}>{item.group || "-"}</td>
                  <td style={tdStyle} title={item.title}>
                    {truncate(item.title, 30)}
                  </td>
                  <td style={tdStyle}>{item.person || "-"}</td>
                  <td style={tdStyle}>{item.date || "-"}</td>
                  <td style={tdStyle} title={item.description}>
                    {truncate(item.description, 40)}
                  </td>
                  <td style={tdStyle}>
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#0070f3", textDecoration: "none" }}
                      >
                        Link
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td style={tdStyle}>
                    {item.active === false ? "❌" : "✅"}
                  </td>
                  <td style={tdStyle}>{formatDate(item.createdAt)}</td>
                  <td style={tdStyle}>{formatDate(item.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {items.length === 0 && (
            <div style={{ padding: "40px", textAlign: "center", color: "#999" }}>
              No items found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Styles
const thStyle: React.CSSProperties = {
  padding: "12px 8px",
  borderBottom: "2px solid #ddd",
  fontWeight: "600",
  position: "sticky",
  top: 0,
  background: "#f5f5f5",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 8px",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: "200px",
};

// Helpers
function truncate(str: string | undefined, maxLen: number): string {
  if (!str) return "-";
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "...";
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