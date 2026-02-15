"use client";

import React, { useEffect, useState } from "react";
import Header from "@/components/Header/Header";
import VideoHub from "@/components/VideoHub/VideoHub";
import AudioHub from "@/components/AudioHub/AudioHub";
import VideoSubmissionForm from "@/components/Forms/VideoSubmissionForm";
import SocialLinksForm from "@/components/Forms/SocialLinksForm";
import BreakingNewsBanner from "@/components/BreakingNews/BreakingNewsBanner";
import Footer from "@/components/Footer/Footer";
import FloatingVideoPlayer from "@/components/FloatingVideoPlayer/FloatingVideoPlayer";
import { PlaybackProvider, usePlayback } from "@/context/PlaybackContext";

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
      {/* Background Image - Fixed */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage: "url('/images/full-site-background.webp')",
          backgroundSize: 'cover',
          backgroundPosition: 'left center',
          backgroundRepeat: 'no-repeat',
        }}
      />

      {/* Background Color Overlay - Applied to all content except header */}
      <div
        className="fixed inset-0 -z-[9]"
        style={{
          backgroundColor: 'rgba(22, 28, 36, 0.05)', // Very minimal overlay to make background image highly visible
        }}
      />

      {/* Header - Positioned above overlay with relative z-index */}
      <div className="relative z-10">
        <Header />
      </div>

      {/* Content with overlay - positioned below header */}
      <div className="relative z-0">
        <main className="container mx-auto px-4 py-8">
          <VideoHub onVideoClick={(video) => {
            handleVideoPlay({
              url: video.url,
              person: video.person || video.personName,
              title: video.title,
              timestamp: video.createdAt,
            });
          }} />
          <AudioHub />
          <VideoSubmissionForm />
          <SocialLinksForm />
        </main>
        <BreakingNewsBanner />
        <Footer />
      </div>

      {/* Floating Video Player */}
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
