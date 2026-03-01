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
    <div className="relative min-h-screen text-white">
      {/* Background Image */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage: "url('/images/full-site-background.webp')",
          backgroundSize: "cover",
          backgroundPosition: "left center",
          backgroundRepeat: "no-repeat",
        }}
      />
      <div
        className="fixed inset-0 -z-[9]"
        style={{ backgroundColor: "rgba(22, 28, 36, 0.05)" }}
      />

      <div className="relative z-10">
        <Header />
      </div>

      {/* Logo below header line, on top of banner — md+ only; mobile shows logo in header */}
      <div
        className="hidden md:block absolute left-8 lg:left-12 z-20 pointer-events-none"
        style={{ top: "72px" }}
      >
        <img
          src="/images/newheaderlogo26feb.jpg"
          alt="Radio Olgoo – Echo of Iranian Civilization"
          className="block h-[168px] w-auto object-contain rounded-lg"
          style={{
            filter: "drop-shadow(0 0 12px rgba(197,155,65,0.5))",
          }}
        />
      </div>

      {/* Hero section — full cinematic image display */}
      <div className="relative z-0">
        <HeroSection />
      </div>

      <div className="relative z-0">
        <main className="   py-8" style={{ paddingLeft: "2%", paddingRight: "2%", margin: "auto" }}>
          <LiveBlock />

          {/* Existing content - section ids for header nav smooth scroll */}
          <section id="video-hub" className="scroll-mt-24">
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
          <section id="revolutionary-music" className="scroll-mt-24">
            <AudioHub />
          </section>
          <section id="video-submission" className="scroll-mt-24">
            <VideoSubmissionForm />
          </section>
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