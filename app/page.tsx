"use client";

import React, { useEffect, useState } from "react";
import Header from "@/components/Header/Header";
import HeroSection from "@/components/HeroSection/HeroSection";
import VideoHub from "@/components/VideoHub/VideoHub";
import AudioHub from "@/components/AudioHub/AudioHub";
import VideoSubmissionForm from "@/components/Forms/VideoSubmissionForm";
import SocialLinksForm from "@/components/Forms/SocialLinksForm";
import BreakingNewsBanner from "@/components/BreakingNews/BreakingNewsBanner";
import Footer from "@/components/Footer/Footer";
import FloatingVideoPlayer from "@/components/FloatingVideoPlayer/FloatingVideoPlayer";
import { PlaybackProvider, usePlayback } from "@/context/PlaybackContext";
import LiveBlock from "@/components/LiveBlock/LiveBlock";

type PlayingVideo = {
  url: string;
  person?: string;
  title?: string;
  timestamp?: string;
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

  return (
    <div id="user-page" className="relative min-h-screen overflow-x-hidden bg-black text-white">
      {/* Hard black base behind everything */}
      <div className="fixed inset-0 -z-20 bg-black" />

      {/* Background image */}
      <div
        className="fixed inset-0 -z-10 bg-black"
        style={{
          backgroundImage: "url('/images/full-site-background.webp')",
          backgroundSize: "cover",
          backgroundPosition: "left center",
          backgroundRepeat: "no-repeat",
        }}
      />

      {/* Light dark overlay */}
      <div
        className="fixed inset-0 -z-[9]"
        style={{ backgroundColor: "rgba(22, 28, 36, 0.05)" }}
      />

      <div className="relative z-10 bg-transparent">
        <Header />
      </div>

      <div className="relative z-0 bg-transparent">
        <HeroSection />
      </div>

      <div className="relative z-0 bg-transparent">
        <main
          className="py-8 bg-transparent"
          style={{ paddingLeft: "2%", paddingRight: "2%", margin: "auto" }}
        >
          <LiveBlock />

          <section id="video-hub" className="scroll-mt-24 bg-transparent">
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
          </section>

          <section id="revolutionary-music" className="scroll-mt-24 bg-transparent">
            <AudioHub />
          </section>

          <section id="video-submission" className="scroll-mt-24 bg-transparent">
            <VideoSubmissionForm />
          </section>

          <div className="bg-transparent">
            <SocialLinksForm />
          </div>
        </main>

        <div className="bg-transparent">
          <BreakingNewsBanner />
        </div>

        <div className="bg-transparent">
          <Footer />
        </div>
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