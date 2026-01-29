// app/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

type Slide = {
  pk: "CENTER" | "BG";
  sk: string;
  url: string;
  enabled: boolean;
  order: number;
  createdAt?: string;
  mediaType?: string;
  category1?: string;
  category2?: string;
  description?: string;
};

type SlidesGetResponse = {
  ok: boolean;
  set: "CENTER" | "BG";
  items: Slide[];
};

async function fetchSlides(set: "CENTER" | "BG") {
  const res = await fetch(`/api/slides?set=${encodeURIComponent(set)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load slides for ${set} (HTTP ${res.status})`);

  const data = (await res.json()) as SlidesGetResponse | Slide[];

  const items = Array.isArray(data)
    ? data
    : Array.isArray((data as any).items)
    ? (data as any).items
    : [];

  return items
    .filter((x) => x?.url && x.enabled !== false)
    .sort(
      (a, b) =>
        (a.order ?? 0) - (b.order ?? 0) ||
        String(a.sk).localeCompare(String(b.sk))
    );
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

export default function HomePage() {
  const streamUrl =
    process.env.NEXT_PUBLIC_STREAM_URL || "https://YOUR-AZURACAST-STREAM-URL-HERE";

  const [bgUrls, setBgUrls] = useState<string[]>([]);
  const [centerUrls, setCenterUrls] = useState<string[]>([]);
  const [err, setErr] = useState("");

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

  const [centerIdx, setCenterIdx] = useState(0);

useEffect(() => {
  // reset when list changes
  setCenterIdx(0);
}, [centerUrls.join("|")]);

const fg = centerUrls.length ? centerUrls[centerIdx % centerUrls.length] : "";

  const bg = useRotator(bgUrls, 7000); // left photo

  // Preload the next BG image for smoother transitions
  const nextBg = useMemo(() => {
    if (!bgUrls.length) return "";
    const idx = bgUrls.indexOf(bg);
    return bgUrls[(idx + 1) % bgUrls.length] || "";
  }, [bg, bgUrls]);

  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <div style={styles.title}>رادیو الگو</div>
        <div style={styles.subtitle}>به زودی</div>
      </header>

      <main style={styles.grid}>
        {/* LEFT: BG image in a frame */}
        <section style={styles.card}>
          <div style={styles.cardTitle}>تصویر</div>
          <div style={styles.mediaFrame}>
            {bg ? (
              <img src={bg} alt="BG" style={styles.bgImg} />
            ) : (
              <div style={styles.empty}>No BG slides yet</div>
            )}
            {nextBg ? <link rel="preload" as="image" href={nextBg} /> : null}
          </div>
        </section>

        {/* RIGHT: CENTER video in a frame */}
        <section style={styles.card}>
          <div style={styles.cardTitle}>ویدیو</div>
          <div style={styles.mediaFrame}>
            {fg ? (
              <video
                key={fg}
                src={fg}
                style={styles.video}
                autoPlay
                muted
                playsInline
                controls
              />
            ) : (
              <div style={styles.empty}>No CENTER videos yet</div>
            )}
          </div>

          <div style={styles.audioRow}>
            <audio controls src={streamUrl} style={styles.audio} />
          </div>

          {err ? <div style={styles.error}>⚠️ {err}</div> : null}
        </section>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: "100vh",
    padding: 18,
    background: "linear-gradient(180deg, #0b0b0f 0%, #14141a 100%)",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    color: "white",
  },

  header: {
    textAlign: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 44,
    fontWeight: 950,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 28,
    fontWeight: 800,
    opacity: 0.9,
    marginTop: 6,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    alignItems: "start",
  },

  card: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.04)",
    padding: 14,
  },

  cardTitle: {
    fontSize: 14,
    fontWeight: 800,
    opacity: 0.85,
    marginBottom: 10,
  },

mediaFrame: {
  width: "100%",
  aspectRatio: "16 / 9",
  borderRadius: 16,
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(0,0,0,0.65)",
},

bgImg: {
  width: "100%",
  height: "100%",
  objectFit: "contain",
  background: "rgba(0,0,0,0.55)",
  display: "block",
},

video: {
  width: "100%",
  height: "100%",
  objectFit: "contain",
  background: "rgba(0,0,0,0.55)",
  display: "block",
},


  empty: {
    height: "100%",
    display: "grid",
    placeItems: "center",
    opacity: 0.75,
    fontWeight: 800,
  },

  audioRow: {
    display: "flex",
    justifyContent: "center",
    paddingTop: 12,
  },
  audio: {
    width: "100%",
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
