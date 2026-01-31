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
  const res = await fetch(`/api/slides?set=${encodeURIComponent(set)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load slides for ${set} (HTTP ${res.status})`);

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
            <div style={styles.title}>رادیو الگو</div>
            <div style={styles.subtitle}>آوی تمدن ایرانی</div>
            <div style={styles.subsubtitle}>Echo of Iranian Civilization</div>
            <div style={styles.subtitle}>به زودی</div>
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
                <div style={styles.empty}>هیچ اسلایدی ثبت نشده</div>
              )}
            </div>
            <div style={styles.hint}>
              {slideUrls.length > 1 ? `تعویض هر ۱۰ ثانیه` : `برای تعویض خودکار، حداقل ۲ اسلاید لازم است`}
            </div>
          </div>

          {/* RIGHT: CENTER VIDEOS */}
          <div style={styles.panel}>
            <div style={styles.panelHeader}></div>
            <div style={styles.frame}>
              {!currentCenter ? (
                <div style={styles.empty}>هیچ ویدیویی ثبت نشده</div>
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
                بعدی
              </button>
            </div>
          </div>
        </div>

        {err ? <div style={styles.error}>⚠️ {err}</div> : null}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
    objectFit: "contain", // show more of the photo
    background: "black",
    transform: "scale(0.95)", // ~30% zoomed out (adjust 0.7–0.85 if you want)
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
    maxWidth: 1400,
    margin: "0 auto",
    padding: "22px 16px 26px",
  },

  // HEADER: right-justified + slightly lower
  header: {
    display: "flex",
    justifyContent: "flex-end",
    marginBottom: 18,
    paddingTop: 14,
  },
  headerText: {
    textAlign: "right",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 6,
    marginTop: 8,
  },

  title: { fontSize: 56, fontWeight: 900, lineHeight: 1.05 },
  subtitle: { fontSize: 34, fontWeight: 900, opacity: 0.95 },
  subsubtitle: { fontSize: 18, fontWeight: 800, opacity: 0.9 },

  // GRID: identical panel sizes + middle space (~2 inches) + moved down
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    columnGap: 192, // ~2 inches at 96dpi
    rowGap: 16,
    alignItems: "start",
    marginTop: 150, // moves both blocks down
    paddingInline: 24,
  },

  panel: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.22)",
    backdropFilter: "blur(10px)",
    padding: 14,
    minHeight: 0,
  },
  panelHeader: {
    fontWeight: 900,
    opacity: 0.9,
    marginBottom: 10,
    textAlign: "center",
    minHeight: 0,
  },

  frame: {
    width: "100%",
    aspectRatio: "16 / 9",
    borderRadius: 16,
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
  },

  actionsRow: { display: "flex", justifyContent: "center", paddingTop: 10 },
  btn: {
    appearance: "none",
    border: "1px solid rgba(255,255,255,0.25)",
    background: "rgba(255,255,255,0.10)",
    color: "white",
    padding: "10px 16px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 900,
  },

  hint: {
    marginTop: 10,
    textAlign: "center",
    opacity: 0.75,
    fontSize: 12,
    fontWeight: 700,
  },

  error: {
    marginTop: 12,
    padding: "10px 12px",
    borderRadius: 12,
    background: "rgba(176,0,32,0.25)",
    border: "1px solid rgba(255,255,255,0.18)",
    fontWeight: 800,
  },
};
