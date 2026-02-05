// Original: app\page.tsx
// app/page.tsx
"use client";

import React, { useEffect, useState } from "react";

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

type Section = 
  | "Video Archives"
  | "Single Videos-Songs"
  | "National Anthems"
  | "Photo Albums"
  | "Live Channels"
  | "Social Media Profiles"
  | "Great-National-Songs-Videos"
  | "In-Transition";

const SECTIONS: Section[] = [
  "Video Archives",
  "Single Videos-Songs",
  "National Anthems",
  "Photo Albums",
  "Live Channels",
  "Social Media Profiles",
  "Great-National-Songs-Videos",
  "In-Transition",
];

function isVideo(url: string): boolean {
  const u = (url || "").toLowerCase();
  return u.includes(".mp4") || u.includes("video");
}

function isImage(url: string): boolean {
  const u = (url || "").toLowerCase();
  return u.includes(".jpg") || u.includes(".jpeg") || u.includes(".png") || u.includes(".webp");
}

async function fetchItems(section: Section): Promise<MediaItem[]> {
  const url = `/api/slides?section=${encodeURIComponent(section)}`;
  
  const res = await fetch(url, { cache: "no-store" });
  
  if (!res.ok) {
    throw new Error(`Failed to load items for ${section} (HTTP ${res.status})`);
  }

  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items : [];

  return items.filter((x: MediaItem) => x.url && x.active !== false);
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return isMobile;
}

export default function HomePage() {
  const [selectedSection, setSelectedSection] = useState<Section>("Video Archives");
  const [items, setItems] = useState<MediaItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isMobile = useIsMobile();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await fetchItems(selectedSection);
        if (cancelled) return;
        setItems(data);
        setCurrentIndex(0);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedSection]);

  const currentItem = items.length > 0 ? items[currentIndex % items.length] : null;

  function nextItem() {
    if (items.length === 0) return;
    setCurrentIndex((x) => (x + 1) % items.length);
  }

  function prevItem() {
    if (items.length === 0) return;
    setCurrentIndex((x) => (x - 1 + items.length) % items.length);
  }

  const styles = getStyles(isMobile);

  return (
    <div style={styles.page}>
      {/* Background */}
      <div style={styles.bgLayer}>
        {currentItem && (
          <>
            {isVideo(currentItem.url) ? (
              <video
                key={currentItem.url}
                src={currentItem.url}
                style={styles.bgMedia}
                autoPlay
                loop
                muted
                playsInline
              />
            ) : isImage(currentItem.url) ? (
              <img src={currentItem.url} alt="" style={styles.bgMedia} />
            ) : null}
          </>
        )}
        <div style={styles.bgOverlay} />
      </div>

      {/* Content */}
      <div style={styles.shell}>
        <header style={styles.header}>
          <div style={styles.headerText}>
            <div style={styles.title}>Ø±Ø§Ø¯ÛŒÙˆ Ø§Ù„Ú¯Ùˆ</div>
            <div style={styles.subtitle}>Ø¢ÙˆÛŒ ØªÙ…Ø¯Ù† Ø§ÛŒØ±Ø§Ù†ÛŒ</div>
            <div style={styles.subsubtitle}>Echo of Iranian Civilization</div>
          </div>
        </header>

        {/* Section Selector */}
        <div style={styles.sectionSelector}>
          <label style={styles.sectionLabel}>Browse by Section:</label>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value as Section)}
            style={styles.sectionSelect}
            disabled={loading}
          >
            {SECTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Current Item Display */}
        {loading ? (
          <div style={styles.panel}>
            <div style={styles.loading}>Loading...</div>
          </div>
        ) : error ? (
          <div style={styles.panel}>
            <div style={styles.error}>âš ï¸ {error}</div>
          </div>
        ) : !currentItem ? (
          <div style={styles.panel}>
            <div style={styles.empty}>No items found in {selectedSection}</div>
          </div>
        ) : (
          <div style={styles.panel}>
            <div style={styles.itemInfo}>
              <h2 style={styles.itemTitle}>{currentItem.title}</h2>
              {currentItem.person && (
                <div style={styles.itemMeta}>
                  <span style={styles.metaLabel}>Person:</span> {currentItem.person}
                </div>
              )}
              {currentItem.date && (
                <div style={styles.itemMeta}>
                  <span style={styles.metaLabel}>Date:</span> {currentItem.date}
                </div>
              )}
              {currentItem.group && (
                <div style={styles.itemMeta}>
                  <span style={styles.metaLabel}>Category:</span> {currentItem.group}
                </div>
              )}
              {currentItem.description && (
                <div style={styles.itemDescription}>{currentItem.description}</div>
              )}
            </div>

            <div style={styles.frame}>
              {isVideo(currentItem.url) ? (
                <video
                  key={currentItem.url}
                  src={currentItem.url}
                  style={styles.media}
                  controls
                  autoPlay
                  playsInline
                />
              ) : isImage(currentItem.url) ? (
                <img src={currentItem.url} alt={currentItem.title} style={styles.media} />
              ) : (
                <div style={styles.empty}>Unsupported media type</div>
              )}
            </div>

            <div style={styles.controls}>
              <button style={styles.btn} onClick={prevItem} disabled={items.length <= 1}>
                â† Previous
              </button>
              <div style={styles.counter}>
                {currentIndex + 1} / {items.length}
              </div>
              <button style={styles.btn} onClick={nextItem} disabled={items.length <= 1}>
                Next â†’
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getStyles(isMobile: boolean): Record<string, React.CSSProperties> {
  return {
    page: {
      position: "relative",
      minHeight: "100vh",
      color: "white",
      overflow: "hidden",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    },
    bgLayer: {
      position: "absolute",
      inset: 0,
      zIndex: 0,
    },
    bgMedia: {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      objectFit: "cover",
      filter: "blur(20px) brightness(0.4)",
    },
    bgOverlay: {
      position: "absolute",
      inset: 0,
      background: "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.7) 100%)",
    },
    shell: {
      position: "relative",
      zIndex: 2,
      maxWidth: isMobile ? "100%" : 1000,
      margin: "0 auto",
      padding: isMobile ? "16px 12px" : "24px 20px",
    },
    header: {
      display: "flex",
      justifyContent: "flex-end",
      marginBottom: isMobile ? 20 : 30,
    },
    headerText: {
      textAlign: "right",
      display: "flex",
      flexDirection: "column",
      gap: isMobile ? 4 : 6,
    },
    title: {
      fontSize: isMobile ? 36 : 56,
      fontWeight: 900,
      lineHeight: 1.05,
    },
    subtitle: {
      fontSize: isMobile ? 20 : 34,
      fontWeight: 900,
      opacity: 0.95,
    },
    subsubtitle: {
      fontSize: isMobile ? 14 : 18,
      fontWeight: 800,
      opacity: 0.9,
    },
    sectionSelector: {
      marginBottom: isMobile ? 20 : 30,
      padding: isMobile ? 16 : 20,
      borderRadius: isMobile ? 12 : 18,
      border: "1px solid rgba(255,255,255,0.18)",
      background: "rgba(0,0,0,0.3)",
      backdropFilter: "blur(10px)",
    },
    sectionLabel: {
      display: "block",
      fontWeight: 900,
      fontSize: isMobile ? 14 : 16,
      marginBottom: 10,
      opacity: 0.9,
    },
    sectionSelect: {
      width: "100%",
      padding: isMobile ? "12px 14px" : "14px 16px",
      borderRadius: isMobile ? 10 : 12,
      border: "1px solid rgba(255,255,255,0.3)",
      background: "rgba(255,255,255,0.15)",
      color: "white",
      fontSize: isMobile ? 16 : 18,
      fontWeight: 800,
      cursor: "pointer",
    },
    panel: {
      borderRadius: isMobile ? 12 : 18,
      border: "1px solid rgba(255,255,255,0.18)",
      background: "rgba(0,0,0,0.25)",
      backdropFilter: "blur(10px)",
      padding: isMobile ? 16 : 20,
    },
    itemInfo: {
      marginBottom: isMobile ? 16 : 20,
    },
    itemTitle: {
      fontSize: isMobile ? 20 : 26,
      fontWeight: 900,
      marginBottom: 12,
    },
    itemMeta: {
      fontSize: isMobile ? 13 : 14,
      opacity: 0.85,
      marginBottom: 6,
    },
    metaLabel: {
      fontWeight: 900,
      opacity: 0.7,
    },
    itemDescription: {
      fontSize: isMobile ? 14 : 15,
      opacity: 0.9,
      marginTop: 10,
      lineHeight: 1.5,
    },
    frame: {
      width: "100%",
      aspectRatio: "16 / 9",
      borderRadius: isMobile ? 10 : 16,
      overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.18)",
      background: "rgba(0,0,0,0.55)",
      marginBottom: isMobile ? 16 : 20,
    },
    media: {
      width: "100%",
      height: "100%",
      objectFit: "contain",
      background: "black",
      display: "block",
    },
    controls: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
    },
    btn: {
      padding: isMobile ? "12px 20px" : "12px 24px",
      borderRadius: isMobile ? 10 : 12,
      border: "1px solid rgba(255,255,255,0.25)",
      background: "rgba(255,255,255,0.10)",
      color: "white",
      cursor: "pointer",
      fontWeight: 900,
      fontSize: isMobile ? 14 : 16,
      minHeight: 44,
    },
    counter: {
      fontWeight: 900,
      fontSize: isMobile ? 14 : 16,
      opacity: 0.8,
    },
    loading: {
      textAlign: "center",
      fontSize: isMobile ? 16 : 18,
      fontWeight: 800,
      padding: isMobile ? 40 : 60,
      opacity: 0.85,
    },
    error: {
      textAlign: "center",
      fontSize: isMobile ? 14 : 16,
      fontWeight: 800,
      padding: isMobile ? 30 : 40,
      color: "#ff6b6b",
    },
    empty: {
      textAlign: "center",
      fontSize: isMobile ? 14 : 16,
      fontWeight: 800,
      padding: isMobile ? 30 : 40,
      opacity: 0.75,
    },
  };
}
