// Original: app\page.tsx
// app/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type SetKind = "CENTER" | "SLIDES" | "BG";

type Slide = {
  pk: SetKind;
  sk: string;
  url: string;
  enabled?: boolean;
  order?: number;
  createdAt?: string;

  mediaType?: string; // e.g. "video/mp4", "image/jpeg"
  category1?: string;
  category2?: string;
  description?: string;
};

type SlidesGetResponse = { ok: true; set: SetKind; items: Slide[] } | Slide[];

function inferMediaTypeFromUrl(url: string): string {
  const u = (url || "").toLowerCase().split("?")[0];
  if (u.endsWith(".mp4") || u.endsWith(".m4v")) return "video/mp4";
  if (u.endsWith(".webm")) return "video/webm";
  if (u.endsWith(".mov")) return "video/quicktime";
  if (u.endsWith(".jpg") || u.endsWith(".jpeg")) return "image/jpeg";
  if (u.endsWith(".png")) return "image/png";
  if (u.endsWith(".gif")) return "image/gif";
  if (u.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

function isVideo(item: Slide | { url: string; mediaType?: string } | string): boolean {
  const mt =
    typeof item === "string"
      ? inferMediaTypeFromUrl(item)
      : item.mediaType || inferMediaTypeFromUrl(item.url);
  return mt.startsWith("video/");
}

async function fetchSlides(set: SetKind): Promise<Slide[]> {
  // NOTE: this is USER UI (public). Admin uses /api/admin/*
  const url = `/api/slides?set=${encodeURIComponent(set)}`;
  console.log(`Fetching ${set} from:`, url);
  
  const res = await fetch(url, {
    cache: "no-store",
  });
  
  console.log(`Response for ${set}:`, res.status, res.statusText);
  
  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Failed to load slides for ${set} (HTTP ${res.status}): ${errorText}`);
  }

  const data = (await res.json()) as SlidesGetResponse;

  const items = Array.isArray(data)
    ? data
    : Array.isArray((data as any).items)
      ? (data as any).items
      : [];

  // IMPORTANT FIX:
  // - Always require url
  // - Respect enabled for CENTER/SLIDES
  // - DO NOT filter BG out just because enabled is false/missing (BG should still show)
  const cleaned = (items || []).filter((x: Slide) => x?.url);

  const filtered =
    set === "BG" ? cleaned : cleaned.filter((x: Slide) => x.enabled !== false);

  return filtered.sort(
    (a, b) =>
      Number(a.order ?? 0) - Number(b.order ?? 0) || String(a.sk).localeCompare(String(b.sk))
  );
}

// rotates through URLs every intervalMs (only if >1)
function useRotator(urls: string[], intervalMs: number) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [urls.join("|")]);

  useEffect(() => {
    if (!urls || urls.length <= 1) return;

    const t = window.setInterval(() => {
      setIdx((x) => (x + 1) % urls.length);
    }, intervalMs);

    return () => window.clearInterval(t);
  }, [urls, intervalMs]);

  return urls.length ? urls[idx % urls.length] : "";
}

// Hook to detect mobile
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return isMobile;
}

export default function HomePage() {
  // BACKGROUND: single active BG item (photo/video)
  const [bgItem, setBgItem] = useState<Slide | null>(null);

  // LEFT: SLIDES rotating every 10s
  const [slideUrls, setSlideUrls] = useState<string[]>([]);

  // RIGHT: CENTER videos play full length, rotate on ended or Next
  const [centerItems, setCenterItems] = useState<Slide[]>([]);
  const [centerIdx, setCenterIdx] = useState(0);

  const [err, setErr] = useState("");

  const centerVideoRef = useRef<HTMLVideoElement | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setErr("");
        const [bg, slides, center] = await Promise.all([
          fetchSlides("BG"),
          fetchSlides("SLIDES"),
          fetchSlides("CENTER"),
        ]);
        if (cancelled) return;

        // BACKGROUND: choose ONE (first/lowest order).
        setBgItem(bg.length ? bg[0] : null);

        // LEFT SLIDES: rotate URLs
        setSlideUrls(slides.map((x) => x.url));

        // RIGHT CENTER: playlist
        setCenterItems(center);
        setCenterIdx(0);
      } catch (e: any) {
        if (cancelled) return;
        setErr(e?.message ?? String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // LEFT rotates every 10 seconds
  const leftSlide = useRotator(slideUrls, 10000);

  const currentCenter = useMemo(() => {
    if (!centerItems.length) return null;
    return centerItems[centerIdx % centerItems.length];
  }, [centerItems, centerIdx]);

  function stopCenterVideo() {
    const v = centerVideoRef.current;
    if (!v) return;
    try {
      v.pause();
      v.currentTime = 0;
    } catch {}
  }

  function nextCenter() {
    if (!centerItems.length) return;
    stopCenterVideo();
    setCenterIdx((x) => (x + 1) % centerItems.length);
  }

  // best-effort autoplay on center change
  useEffect(() => {
    if (!currentCenter) return;
    if (!isVideo(currentCenter)) return;

    const v = centerVideoRef.current;
    if (!v) return;

    v.currentTime = 0;
    v.play().catch(() => {});
  }, [currentCenter?.url]);

  // Get responsive styles
  const styles = getStyles(isMobile);

  return (
    <div style={styles.page}>
      {/* BACKGROUND LAYER (full screen) */}
      <div style={styles.bgLayer} aria-hidden="true">
        {bgItem ? (
          isVideo(bgItem) ? (
            <video
              key={bgItem.url}
              src={bgItem.url}
              style={styles.bgMedia}
              autoPlay
              loop
              muted
              playsInline
            />
          ) : (
            <img src={bgItem.url} alt="" style={styles.bgMedia} />
          )
        ) : null}

        {/* dark overlay so text/panels readable */}
        <div style={styles.bgOverlay} />
      </div>

      {/* FOREGROUND CONTENT */}
      <div style={styles.shell}>
        <div style={styles.header}>
          <div style={styles.headerText}>
            <div style={styles.title}>Ø±Ø§Ø¯ÛŒÙˆ Ø§Ù„Ú¯Ùˆ</div>
            <div style={styles.subtitle}>Ø¢ÙˆÛŒ ØªÙ…Ø¯Ù† Ø§ÛŒØ±Ø§Ù†ÛŒ</div>
            <div style={styles.subsubtitle}>Echo of Iranian Civilization</div>
            <div style={styles.subtitle}>Ø¨Ù‡ Ø²ÙˆØ¯ÛŒ</div>
          </div>
        </div>

        <div style={styles.grid}>
          {/* LEFT: SLIDES */}
          <div style={styles.panel}>
            <div style={styles.panelHeader}></div>
            <div style={styles.frame}>
              {leftSlide ? (
                <img src={leftSlide} alt="Slide" style={styles.media} />
              ) : (
                <div style={styles.empty}>Ù‡ÛŒÚ† Ø§Ø³Ù„Ø§ÛŒØ¯ÛŒ Ø«Ø¨Øª Ù†Ø´Ø¯Ù‡</div>
              )}
            </div>
            <div style={styles.hint}>
              {slideUrls.length > 1 ? `ØªØ¹ÙˆÛŒØ¶ Ù‡Ø± Û±Û° Ø«Ø§Ù†ÛŒÙ‡` : `Ø¨Ø±Ø§ÛŒ ØªØ¹ÙˆÛŒØ¶ Ø®ÙˆØ¯Ú©Ø§Ø±ØŒ Ø­Ø¯Ø§Ù‚Ù„ Û² Ø§Ø³Ù„Ø§ÛŒØ¯ Ù„Ø§Ø²Ù… Ø§Ø³Øª`}
            </div>
          </div>

          {/* RIGHT: CENTER VIDEOS */}
          <div style={styles.panel}>
            <div style={styles.panelHeader}></div>
            <div style={styles.frame}>
              {!currentCenter ? (
                <div style={styles.empty}>Ù‡ÛŒÚ† ÙˆÛŒØ¯ÛŒÙˆÛŒÛŒ Ø«Ø¨Øª Ù†Ø´Ø¯Ù‡</div>
              ) : isVideo(currentCenter) ? (
                <video
                  key={`center-${centerIdx}-${currentCenter.url}`}
                  ref={centerVideoRef}
                  src={currentCenter.url}
                  style={styles.media}
                  autoPlay
                  playsInline
                  controls
                  onEnded={nextCenter}
                />
              ) : (
                <img src={currentCenter.url} alt="Center" style={styles.media} />
              )}
            </div>

            <div style={styles.actionsRow}>
              <button style={styles.btn} onClick={nextCenter} disabled={centerItems.length <= 1}>
                Ø¨Ø¹Ø¯ÛŒ
              </button>
            </div>
          </div>
        </div>

        {err ? <div style={styles.error}>âš ï¸ {err}</div> : null}
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

    // BACKGROUND ENGINE
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
      objectFit: "contain",
      background: "black",
      transform: isMobile ? "scale(1)" : "scale(0.95)",
    },
    bgOverlay: {
      position: "absolute",
      inset: 0,
      background:
        "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.65) 55%, rgba(0,0,0,0.82) 100%)",
    },

    // FOREGROUND
    shell: {
      position: "relative",
      zIndex: 2,
      maxWidth: isMobile ? "100%" : 1400,
      margin: "0 auto",
      padding: isMobile ? "16px 12px 20px" : "22px 16px 26px",
    },

    // HEADER: right-justified + slightly lower
    header: {
      display: "flex",
      justifyContent: "flex-end",
      marginBottom: isMobile ? 12 : 18,
      paddingTop: isMobile ? 8 : 14,
    },
    headerText: {
      textAlign: "right",
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      gap: isMobile ? 4 : 6,
      marginTop: isMobile ? 4 : 8,
    },

    title: {
      fontSize: isMobile ? 32 : 56,
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

    // GRID: stacks on mobile, side-by-side on desktop
    grid: {
      display: "grid",
      gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
      columnGap: isMobile ? 0 : 192,
      rowGap: isMobile ? 20 : 16,
      alignItems: "start",
      marginTop: isMobile ? 24 : 150,
      paddingInline: isMobile ? 0 : 24,
    },

    panel: {
      borderRadius: isMobile ? 12 : 18,
      border: "1px solid rgba(255,255,255,0.18)",
      background: "rgba(0,0,0,0.22)",
      backdropFilter: "blur(10px)",
      padding: isMobile ? 10 : 14,
      minHeight: 0,
    },
    panelHeader: {
      fontWeight: 900,
      opacity: 0.9,
      marginBottom: isMobile ? 8 : 10,
      textAlign: "center",
      minHeight: 0,
    },

    frame: {
      width: "100%",
      aspectRatio: "16 / 9",
      borderRadius: isMobile ? 10 : 16,
      overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.18)",
      background: "rgba(0,0,0,0.55)",
    },

    media: {
      width: "100%",
      height: "100%",
      objectFit: "contain",
      background: "black",
      display: "block",
    },

    empty: {
      height: "100%",
      display: "grid",
      placeItems: "center",
      opacity: 0.85,
      fontWeight: 800,
      fontSize: isMobile ? 14 : 16,
      padding: isMobile ? "0 12px" : 0,
    },

    actionsRow: {
      display: "flex",
      justifyContent: "center",
      paddingTop: isMobile ? 8 : 10,
    },
    btn: {
      appearance: "none",
      border: "1px solid rgba(255,255,255,0.25)",
      background: "rgba(255,255,255,0.10)",
      color: "white",
      padding: isMobile ? "12px 20px" : "10px 16px",
      borderRadius: isMobile ? 10 : 12,
      cursor: "pointer",
      fontWeight: 900,
      fontSize: isMobile ? 16 : 14,
      minHeight: 44, // Better touch target for mobile
    },

    hint: {
      marginTop: isMobile ? 8 : 10,
      textAlign: "center",
      opacity: 0.75,
      fontSize: isMobile ? 11 : 12,
      fontWeight: 700,
      padding: isMobile ? "0 8px" : 0,
    },

    error: {
      marginTop: 12,
      padding: isMobile ? "8px 10px" : "10px 12px",
      borderRadius: isMobile ? 10 : 12,
      background: "rgba(176,0,32,0.25)",
      border: "1px solid rgba(255,255,255,0.18)",
      fontWeight: 800,
      fontSize: isMobile ? 13 : 14,
    },
  };
}
