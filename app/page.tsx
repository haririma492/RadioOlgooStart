"use client";

import React, { useEffect, useMemo, useState } from "react";
import Header from "@/components/Header/Header";
import VideoHub from "@/components/VideoHub/VideoHub";
import AudioHub from "@/components/AudioHub/AudioHub";
import VideoSubmissionForm from "@/components/Forms/VideoSubmissionForm";
import SocialLinksForm from "@/components/Forms/SocialLinksForm";
import BreakingNewsBanner from "@/components/BreakingNews/BreakingNewsBanner";
import Footer from "@/components/Footer/Footer";
import FloatingVideoPlayer from "@/components/FloatingVideoPlayer/FloatingVideoPlayer";
import LiveSection from "@/components/LiveSection/LiveSection";
import { PlaybackProvider, usePlayback } from "@/context/PlaybackContext";

type PlayingVideo = {
  url: string;
  person?: string;
  title?: string;
  timestamp?: string;
};

type LiveChannelInput = {
  id: string;
  title: string;
  url: string;
  streamsUrl: string;
};

type LiveChannelStatus = {
  id: string;
  state: "LIVE" | "OFFLINE" | "ERROR";
  liveVideoId: string | null;
  watchUrl: string | null;
  embedUrl: string | null;
  reason?: string;
  debug?: { errors?: string[]; resolvedBy?: string };
};

type ExternalSourceInput = {
  id: string;
  title: string;
  url: string;
};

type ExternalSourceStatus = {
  id: string;
  state: "LIVE" | "OFFLINE" | "ERROR";
};

function HomePageContent() {
  const [playingVideo, setPlayingVideo] = useState<PlayingVideo | null>(null);
  const { activePlayback, setActivePlayback } = usePlayback();

  useEffect(() => {
    if (activePlayback && activePlayback.source !== "floating") {
      setPlayingVideo(null);
    }
  }, [activePlayback]);

  const handleVideoPlay = (video: PlayingVideo) => {
    setActivePlayback("floating", video.url);
    setPlayingVideo(video);
  };

  const handleClosePlayer = () => {
    setActivePlayback(null);
    setPlayingVideo(null);
  };

  const openMiniWindow = (url: string, title: string) => {
    try {
      const width = 520;
      const height = 460;

      const left = Math.max(0, Math.floor(window.screenX + window.outerWidth - width - 24));
      const top = Math.max(0, Math.floor(window.screenY + 80));

      const features = [
        `popup=yes`,
        `width=${width}`,
        `height=${height}`,
        `left=${left}`,
        `top=${top}`,
        `resizable=yes`,
        `scrollbars=yes`,
        `noopener=yes`,
        `noreferrer=yes`,
      ].join(",");

      const w = window.open(url, title.replace(/\s+/g, "_"), features);
      if (!w) window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const liveChannels: LiveChannelInput[] = useMemo(
    () => [
      { id: "IRANINTL", title: "IRANINTL", url: "https://www.youtube.com/@IRANINTL/streams", streamsUrl: "https://www.youtube.com/@IRANINTL/streams" },
      { id: "MoradVaisi", title: "Morad Vaisi", url: "https://www.youtube.com/@MoradVaisi/streams", streamsUrl: "https://www.youtube.com/@MoradVaisi/streams" },
      { id: "mojtabavahedi43", title: "Mojtaba Vahedi", url: "https://www.youtube.com/@mojtabavahedi43/streams", streamsUrl: "https://www.youtube.com/@mojtabavahedi43/streams" },
    ],
    []
  );

  const externalSources: ExternalSourceInput[] = useMemo(
    () => [
      { id: "IranNationalRevolutionTV", title: "Iran National Revolution TV", url: "https://iranopasmigirim.com/en/iran-national-revolution-tv" },
    ],
    []
  );

  const [ytStatusMap, setYtStatusMap] = useState<Record<string, LiveChannelStatus>>({});
  const [extStatusMap, setExtStatusMap] = useState<Record<string, ExternalSourceStatus>>({});
  const [liveLoading, setLiveLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLiveLoading(true);

        const ytRes = await fetch("/api/youtube/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ channels: liveChannels.map((c) => ({ id: c.id, url: c.url })) }),
        });
        const ytData = await ytRes.json();

        const extRes = await fetch("/api/external/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ sources: externalSources.map((s) => ({ id: s.id, url: s.url })) }),
        });
        const extData = await extRes.json();

        if (cancelled) return;

        const nextYt: Record<string, LiveChannelStatus> = {};
        for (const it of ytData?.items ?? []) {
          nextYt[it.id] = {
            id: it.id,
            state: it.state,
            liveVideoId: it.liveVideoId ?? null,
            watchUrl: it.watchUrl ?? null,
            embedUrl: it.embedUrl ?? null,
            reason: it.reason,
            debug: it.debug,
          };
        }
        setYtStatusMap(nextYt);

        const nextExt: Record<string, ExternalSourceStatus> = {};
        for (const it of extData?.items ?? []) nextExt[it.id] = { id: it.id, state: it.state };
        setExtStatusMap(nextExt);
      } catch {
        if (!cancelled) {
          setYtStatusMap({});
          setExtStatusMap({});
        }
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    };

    run();
    const t = window.setInterval(run, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [liveChannels, externalSources]);

  const combinedCards = useMemo(() => {
    const ytCards = liveChannels.map((c) => {
      const st = ytStatusMap[c.id] ?? ({ id: c.id, state: "OFFLINE", liveVideoId: null, watchUrl: null, embedUrl: null } as LiveChannelStatus);
      return { kind: "youtube" as const, id: c.id, title: c.title, openUrl: c.streamsUrl, state: st.state, embedUrl: st.embedUrl, st };
    });

    const extCards = externalSources.map((s) => {
      const st = extStatusMap[s.id] ?? ({ id: s.id, state: "OFFLINE" } as ExternalSourceStatus);
      return { kind: "external" as const, id: s.id, title: s.title, openUrl: s.url, state: st.state, embedUrl: null as string | null, st };
    });

    const all = [...ytCards, ...extCards];
    const rank = (state: string) => (state === "LIVE" ? 0 : state === "OFFLINE" ? 1 : 2);
    all.sort((a, b) => rank(a.state) - rank(b.state));
    return all;
  }, [liveChannels, externalSources, ytStatusMap, extStatusMap]);

  return (
    <div className="relative min-h-screen text-white">
      <div className="fixed inset-0 -z-10" style={{ backgroundImage: "url('/images/full-site-background.webp')", backgroundSize: "cover", backgroundPosition: "left center", backgroundRepeat: "no-repeat" }} />
      <div className="fixed inset-0 -z-[9]" style={{ backgroundColor: "rgba(22, 28, 36, 0.05)" }} />

      <div className="relative z-10"><Header /></div>

      <div className="relative z-0">
        <main className=" py-8"
        style={{
          marginLeft: '10%',
          marginRight: '10%',
        }}
        >
          <LiveSection
            cards={combinedCards}
            loading={liveLoading}
            onOpenMiniWindow={openMiniWindow}
          />

          <VideoHub
            onVideoClick={(video) => {
              handleVideoPlay({
                url: video.url,
                person: video.person || video.personName,
                title: video.title,
                timestamp: video.createdAt,
              });
            }}
          />
          <AudioHub />
          <VideoSubmissionForm />
          <SocialLinksForm />
        </main>

        <BreakingNewsBanner />
        <Footer />
      </div>

      <FloatingVideoPlayer
        isOpen={!!playingVideo}
        onClose={handleClosePlayer}
        videoUrl={playingVideo?.url}
        person={playingVideo?.person}
        title={playingVideo?.title}
        timestamp={playingVideo?.timestamp}
      />
    </div>
  );
}

export default function HomePage() {
  return (
    <PlaybackProvider>
      <HomePageContent />
    </PlaybackProvider>
  );
}
