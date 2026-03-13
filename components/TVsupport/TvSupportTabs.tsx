"use client";

export type TvTabKey = "playlist" | "schedule" | "subtitles" | "live" | "admin";

type Props = {
  activeTab: TvTabKey;
  onChange: (tab: TvTabKey) => void;
};

const tabs: { key: TvTabKey; label: string }[] = [
  { key: "playlist", label: "Playlist" },
  { key: "schedule", label: "Schedule" },
  { key: "subtitles", label: "Subtitles" },
  { key: "live", label: "Live" },
  { key: "admin", label: "Admin / Backfill" },
];

export default function TvSupportTabs({ activeTab, onChange }: Props) {
  return (
    <div
      style={{
        display: "flex",
        gap: "10px",
        flexWrap: "wrap",
        borderBottom: "1px solid #334155",
        paddingBottom: "14px",
      }}
    >
      {tabs.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            style={{
              padding: "10px 16px",
              borderRadius: "999px",
              border: active ? "1px solid #3b82f6" : "1px solid #475569",
              background: active ? "#1d4ed8" : "#0f172a",
              color: "#f8fafc",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
