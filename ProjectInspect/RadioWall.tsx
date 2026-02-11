"use client";

import React, { useEffect, useState } from "react";

type SlideSet = "CENTER" | "BG";

type Slide = {
  pk: SlideSet;
  sk: string;
  url: string;
  enabled: boolean;
  order: number;
  createdAt?: string;
};

type SlidesResponse =
  | { ok: true; set: SlideSet; items: Slide[] }
  | Slide[];

async function fetchSlides(set: SlideSet) {
  const res = await fetch(`/api/slides?set=${encodeURIComponent(set)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load slides for ${set} (HTTP ${res.status})`);

  const data = (await res.json()) as SlidesResponse;
  const items = Array.isArray(data) ? data : Array.isArray((data as any).items) ? (data as any).items : [];

  return items
    .filter((x) => x?.url && x.enabled !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.sk).localeCompare(String(b.sk)));
}

function useRotator(urls: string[], intervalMs: number) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (!urls.length) return;
    setI(0);
    const t = window.setInterval(() => setI((x) => (x + 1) % urls.length), intervalMs);
    return () => window.clearInterval(t);
  }, [urls, intervalMs]);

  return urls.length ? urls[i % urls.length] : "";
}

export default function RadioWall({ streamUrl }: { streamUrl: string }) {
  const [bgUrls, setBgUrls] = useState<string[]>([]);
  const [centerUrls, setCenterUrls] = useState<string[]>([]);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setErr("");
        const [bg, center] = await Promise.all([fetchSlides("BG"), fetchSlides("CENTER")]);
        if (cancelled) return;
        setBgUrls(bg.map((x) => x.url));
        setCenterUrls(center.map((x) => x.url));
      } catch (e: any) {
        if (cancelled) return;
        setErr(e?.message ?? String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const bg = useRotator(bgUrls, 7000); // background every 7 sec
  const fg = useRotator(centerUrls, 5000); // center every 5 sec

  return (
    <div style={styles.shell}>
      {/* Background wallpaper slideshow */}
      <div style={styles.bgWrap}>
        {bg ? <img src={bg} alt="background" style={styles.bgImg} /> : null}
        <div style={styles.bgOverlay} />
      </div>

      {/* Center content */}
      <div style={styles.centerWrap}>
        <div style={styles.card}>
          {/* Big Persian text in the middle */}
          <div style={styles.textBlock}>
            <div style={styles.title}>رادیو الگو</div>
            <div style={styles.subtitle}>به زودی</div>
          </div>

          {/* Foreground (center) slideshow */}
          <div style={styles.frame}>
            {fg ? (
              <img src={fg} alt="center-slide" style={styles.fgImg} />
            ) : (
              <div style={styles.empty}>No CENTER slides yet</div>
            )}
          </div>

          {/* Audio */}
          <div style={styles.audioRow}>
            <audio controls src={streamUrl} style={styles.audio} />
          </div>

          {err ? <div style={styles.error}>⚠️ {err}</div> : null}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    position: "relative",
    minHeight: "100vh",
    overflow: "hidden",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    color: "white",
  },

  // Background
  bgWrap: { position: "absolute", inset: 0, zIndex: 0 },
  bgImg: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transform: "scale(1.02)",
  },
  bgOverlay: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.60) 60%, rgba(0,0,0,0.82) 100%)",
  },

  // Center card
  centerWrap: {
    position: "relative",
    zIndex: 2,
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 18,
  },

  // ✅ This is the black-ish frame around center area — made MORE transparent
  card: {
    width: "min(980px, 100%)",
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.18)", // <-- more transparent
    backdropFilter: "blur(10px)",
    boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
    padding: 18,
  },

  textBlock: { textAlign: "center", padding: "10px 10px 14px" },

  // Persian big text (same size for both lines)
  title: { fontSize: 56, fontWeight: 950, letterSpacing: 0.5, lineHeight: 1.05 },
  subtitle: { fontSize: 56, fontWeight: 850, opacity: 0.95, marginTop: 10, lineHeight: 1.05 },

  // Foreground image frame
  frame: {
    width: "min(760px, 100%)",
    height: "min(380px, 52vw)",
    margin: "0 auto",
    borderRadius: 18,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
  },
  fgImg: { width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 },

  empty: {
    height: "100%",
    display: "grid",
    placeItems: "center",
    opacity: 0.85,
    fontWeight: 800,
  },

  audioRow: { display: "flex", justifyContent: "center", paddingTop: 14 },
  audio: { width: "min(760px, 100%)" },

  error: {
    marginTop: 12,
    padding: "10px 12px",
    borderRadius: 12,
    background: "rgba(176,0,32,0.25)",
    border: "1px solid rgba(255,255,255,0.18)",
    fontWeight: 800,
  },
};
