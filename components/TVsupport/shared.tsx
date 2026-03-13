"use client";

import { ReactNode } from "react";

export function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid #334155",
        borderRadius: "14px",
        background: "#0f172a",
        padding: "18px",
        marginBottom: "18px",
      }}
    >
      <div style={{ marginBottom: "14px" }}>
        <div style={{ fontSize: "18px", fontWeight: 700 }}>{title}</div>
        {subtitle ? (
          <div style={{ color: "#94a3b8", fontSize: "13px", marginTop: "4px" }}>
            {subtitle}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function PlaceholderText({ text }: { text: string }) {
  return (
    <div
      style={{
        color: "#cbd5e1",
        fontSize: "14px",
        lineHeight: 1.6,
        whiteSpace: "pre-wrap",
      }}
    >
      {text}
    </div>
  );
}

export function Field({
  label,
  placeholder,
}: {
  label: string;
  placeholder?: string;
}) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <div style={{ marginBottom: "6px", fontWeight: 600 }}>{label}</div>
      <input
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: "10px",
          border: "1px solid #475569",
          background: "#111827",
          color: "#f8fafc",
        }}
      />
    </div>
  );
}

export function ActionButton({ label }: { label: string }) {
  return (
    <button
      style={{
        padding: "10px 14px",
        borderRadius: "10px",
        border: "1px solid #475569",
        background: "#1e293b",
        color: "#f8fafc",
        fontWeight: 700,
        cursor: "pointer",
        marginRight: "10px",
      }}
    >
      {label}
    </button>
  );
}
