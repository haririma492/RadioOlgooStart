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

  return (items || [])
    .filter((x: Slide) => x?.url && x.enabled !== false)
    .sort(
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
    const t = window.setInterval(() => setIdx((x) => (x + 1) % urls.length), intervalMs);
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

        setBgItem(bg.length ? bg[0] : null);
        setSlideUrls(slides.map((x) => x.url));
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
    <div className="page">
      {/* BACKGROUND LAYER (full screen) */}
      <div className="bgLayer" aria-hidden="true">
        {bgItem ? (
          isVideo(bgItem) ? (
            <video key={bgItem.url} src={bgItem.url} className="bgMedia" autoPlay loop muted playsInline />
          ) : (
            <img src={bgItem.url} alt="" className="bgMedia" />
          )
        ) : null}
        <div className="bgOverlay" />
      </div>

      {/* FOREGROUND CONTENT */}
      <div className="shell">
        <div className="header">
          <div className="headerText">
            <div className="title">رادیو الگو</div>
            <div className="subtitle">آوی تمدن ایرانی</div>
            <div className="subsubtitle">Echo of Iranian Civilization</div>
            <div className="subtitle">به زودی</div>
          </div>
        </div>

        <div className="grid">
          {/* LEFT: SLIDES */}
          <div className="panel">
            <div className="frame">
              {leftSlide ? (
                <img src={leftSlide} alt="Slide" className="media" />
              ) : (
                <div className="empty">هیچ اسلایدی ثبت نشده</div>
              )}
            </div>
            <div className="hint">
              {slideUrls.length > 1 ? `تعویض هر ۱۰ ثانیه` : `برای تعویض خودکار، حداقل ۲ اسلاید لازم است`}
            </div>
          </div>

          {/* RIGHT: CENTER VIDEOS */}
          <div className="panel">
            <div className="frame">
              {!currentCenter ? (
                <div className="empty">هیچ ویدیویی ثبت نشده</div>
              ) : isVideo(currentCenter) ? (
                <video
                  key={`center-${centerIdx}-${currentCenter.url}`}
                  ref={centerVideoRef}
                  src={currentCenter.url}
                  className="media"
                  autoPlay
                  playsInline
                  controls
                  onEnded={nextCenter}
                />
              ) : (
                <img src={currentCenter.url} alt="Center" className="media" />
              )}
            </div>

            <div className="actionsRow">
              <button className="btn" onClick={nextCenter} disabled={centerItems.length <= 1}>
                بعدی
              </button>
            </div>
          </div>
        </div>

        {err ? <div className="error">⚠️ {err}</div> : null}
      </div>

      <style jsx>{`
        .page {
          position: relative;
          min-height: 100vh;
          color: white;
          overflow: hidden;
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        }

        /* BACKGROUND */
        .bgLayer {
          position: absolute;
          inset: 0;
          z-index: 0;
        }
        .bgMedia {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover; /* looks like a real background */
          transform: scale(0.7); /* ~30% zoomed out */
          transform-origin: center;
          filter: saturate(1.02);
        }
        .bgOverlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            180deg,
            rgba(0, 0, 0, 0.45) 0%,
            rgba(0, 0, 0, 0.65) 55%,
            rgba(0, 0, 0, 0.82) 100%
          );
        }

        /* FOREGROUND */
        .shell {
          position: relative;
          z-index: 2;
          max-width: 1400px;
          margin: 0 auto;
          padding: 18px 14px 26px;
        }

        /* header: right aligned */
        .header {
          display: flex;
          justify-content: flex-end;
          padding-top: 10px;
          margin-bottom: 10px;
        }
        .headerText {
          text-align: right;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 6px;
          margin-top: 8px;
        }

        .title {
          font-size: 56px;
          font-weight: 900;
          line-height: 1.05;
        }
        .subtitle {
          font-size: 34px;
          font-weight: 900;
          opacity: 0.95;
        }
        .subsubtitle {
          font-size: 18px;
          font-weight: 800;
          opacity: 0.9;
        }

        /* GRID: desktop = two columns with big middle gap */
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          column-gap: 192px; /* ~2 inches at 96dpi */
          row-gap: 16px;
          align-items: start;
          margin-top: 64px; /* move blocks down */
          padding-inline: 24px;
        }

        .panel {
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(0, 0, 0, 0.22);
          backdrop-filter: blur(10px);
          padding: 14px;
        }

        .frame {
          width: 100%;
          aspect-ratio: 16 / 9;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(0, 0, 0, 0.55);
        }

        .media {
          width: 100%;
          height: 100%;
          object-fit: contain;
          background: black;
          display: block;
        }

        .empty {
          height: 100%;
          display: grid;
          place-items: center;
          opacity: 0.85;
          font-weight: 800;
        }

        .actionsRow {
          display: flex;
          justify-content: center;
          padding-top: 10px;
        }

        .btn {
          appearance: none;
          border: 1px solid rgba(255, 255, 255, 0.25);
          background: rgba(255, 255, 255, 0.1);
          color: white;
          padding: 10px 16px;
          border-radius: 12px;
          cursor: pointer;
          font-weight: 900;
        }

        .hint {
          margin-top: 10px;
          text-align: center;
          opacity: 0.75;
          font-size: 12px;
          font-weight: 700;
        }

        .error {
          margin-top: 12px;
          padding: 10px 12px;
          border-radius: 12px;
          background: rgba(176, 0, 32, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.18);
          font-weight: 800;
        }

        /* =========================
           RESPONSIVE (mobile/tablet)
           Make frames BIG on mobile
           ========================= */
        @media (max-width: 980px) {
          .shell {
            max-width: 900px;
            padding: 16px 12px 22px;
          }
          .grid {
            grid-template-columns: 1fr; /* stack */
            column-gap: 0;
            row-gap: 14px;
            margin-top: 18px; /* much less on mobile */
            padding-inline: 0;
          }
          .panel {
            padding: 12px;
          }
          .frame {
            /* make it visually larger on phones */
            aspect-ratio: 16 / 10;
            min-height: 240px;
          }
          .title {
            font-size: 40px;
          }
          .subtitle {
            font-size: 24px;
          }
          .subsubtitle {
            font-size: 14px;
          }
        }

        @media (max-width: 480px) {
          .frame {
            min-height: 280px; /* even bigger on small phones */
            aspect-ratio: 16 / 11;
          }
          .title {
            font-size: 34px;
          }
          .subtitle {
            font-size: 20px;
          }
        }
      `}</style>
    </div>
  );
}
