"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import ProfileCardWithDropdown from "./ProfileCardWithDropdown";
import PersonProfileModal from "./PersonProfileModal";
import ProfileRowWithNav from "./ProfileRowWithNav";
import DateDisplay from "@/components/DateDisplay/DateDisplay";
import { usePlayback } from "@/context/PlaybackContext";

type VideoItem = {
  id: string;
  thumbnail: string;
  url: string;
  title?: string;
  isFavourite?: boolean;
  personName?: string;
  person?: string;
  description?: string;
  createdAt?: string;
  group?: string;
};

type MediaItem = {
  PK: string;
  url: string;
  section: string;
  group: string;
  person: string;
  title: string;
  description: string;
  createdAt: string;
};

type VideoHubProps = {
  onVideoClick?: (video: VideoItem) => void;
};

type Profile = {
  person: string;
  pictureUrl: string;
  videoCount: number;
};

export default function VideoHub({ onVideoClick }: VideoHubProps) {
  const { activePlayback, setActivePlayback } = usePlayback();
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalPlayingVideo, setModalPlayingVideo] = useState<VideoItem | null>(null);
  const [playingVideoOnCard, setPlayingVideoOnCard] = useState<{ personName: string; video: VideoItem } | null>(null);
  const [today, setToday] = useState(() => new Date());
  const hubContentRef = useRef<HTMLDivElement>(null);

  // Keep "today" in sync (mount + midnight)
  useEffect(() => {
    setToday(new Date());
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = nextMidnight.getTime() - now.getTime();
    const t = setTimeout(() => setToday(new Date()), msUntilMidnight);
    return () => clearTimeout(t);
  }, []);

  // Fetch media from API on mount
  useEffect(() => {
    async function fetchMedia() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/media");
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();

        if (data.ok && Array.isArray(data.items)) {
          setMediaItems(data.items);
        } else {
          setError("Failed to load videos: Invalid response format");
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Error fetching videos";
        setError(errorMessage);
        console.error("Error fetching media:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchMedia();
  }, []);

  // Sync from global playback: clear card/modal when another source is active
  useEffect(() => {
    if (!activePlayback) return;
    const cardId = playingVideoOnCard
      ? `${playingVideoOnCard.personName}-${playingVideoOnCard.video.id}`
      : null;
    if (
      activePlayback.source !== "video-hub-card" ||
      (cardId !== null && activePlayback.id !== cardId)
    ) {
      setPlayingVideoOnCard(null);
    }
  }, [activePlayback, playingVideoOnCard]);

  useEffect(() => {
    if (!activePlayback) return;
    const modalId = modalPlayingVideo?.id ?? null;
    if (
      activePlayback.source !== "video-hub-modal" ||
      (modalId !== null && activePlayback.id !== modalId)
    ) {
      setModalPlayingVideo(null);
    }
  }, [activePlayback, modalPlayingVideo]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const inHub = hubContentRef.current?.contains(target);
      const inDropdownPortal = (target as Element).closest?.("[data-profile-dropdown-portal]");
      if (!inHub && !inDropdownPortal) {
        setExpandedPerson(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Normalize person name for matching (e.g. "Manoto Tv" and "manototv" → same key)
  const normalizePerson = (name: string): string =>
    (name ?? "").trim().toLowerCase().replace(/\s+/g, " ").replace(/\s/g, "");

  // Match YouTube video section (handles "Youtube Chanel Videos" / "Youtube Channel Videos", any casing)
  const isYoutubeVideoSection = (section: string): boolean => {
    const sn = (section ?? "").trim().toLowerCase().replace(/\s+/g, " ");
    return sn === "youtube chanel videos" || sn === "youtube channel videos";
  };

  // Get profiles from Youtube_Channel_Profile_Picture section, filtered by category
  const getProfiles = (category?: string): Profile[] => {
    const profilesMap = new Map<string, { person: string; pictureUrl: string; videoCount: number }>();
    
    // First, find all profile pictures (exclude "Reza Pahlavi" - he goes in "Your Favourite")
    const profilePictures = mediaItems.filter(
      item => item.section === "Youtube_Channel_Profile_Picture"  && item.person.trim() !== "Reza Pahlavi"
    );
    
    // Filter videos by category if specified
    let filteredVideos = mediaItems.filter(item => {
      const url = (item.url ?? "").toLowerCase();
      // Check if it's a video file (.mp4 in path; presigned URLs may have query string)
      if (!url.includes(".mp4")) return false;
      // Skip videos without person (they can't be associated with profiles)
      if (!item.person || item.person.trim() === "") return false;
      // Exclude "Reza Pahlavi" - he goes in "Your Favourite"
      if (item.person.trim() === "Reza Pahlavi") return false;
      
      if (!category) return true;
      
      const group = (item.group ?? "").trim();
      const isYoutubeVideos = isYoutubeVideoSection(item.section ?? "");
      const isNews = group.toLowerCase() === "news";
      const isPoliticalAnalysis = group === "Political Analysis";
      if (category === "Political") {
        return isYoutubeVideos && isPoliticalAnalysis;
      } else if (category === "News") {
        return isYoutubeVideos && isNews;
      }
      
      return false;
    });
    
    // Count videos per person (keyed by normalized name); keep one display name per normalized key
    const videoCountsByNormalized = new Map<string, { count: number; displayName: string }>();
    filteredVideos.forEach(item => {
      const personName = item.person?.trim();
      if (!personName) return;
      const key = normalizePerson(personName);
      const existing = videoCountsByNormalized.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        videoCountsByNormalized.set(key, { count: 1, displayName: personName });
      }
    });
    
    // Build profiles: match profile pictures by normalized person name so "manototv" matches "Manoto Tv" videos
    profilePictures.forEach(item => {
      const personName = item.person?.trim();
      if (!personName) return;
      const key = normalizePerson(personName);
      const entry = videoCountsByNormalized.get(key);
      if (entry) {
        // Use display name from videos for consistency; use profile picture from this item
        profilesMap.set(key, {
          person: entry.displayName,
          pictureUrl: item.url,
          videoCount: entry.count,
        });
      }
    });
    
    // Include persons who have videos in category but no profile picture (key by normalized to avoid duplicates)
    videoCountsByNormalized.forEach((entry, key) => {
      if (normalizePerson(entry.displayName) === "rezapahlavi") return; // Reza Pahlavi is in Favourite
      if (!profilesMap.has(key)) {
        profilesMap.set(key, {
          person: entry.displayName,
          pictureUrl: "",
          videoCount: entry.count,
        });
      }
    });
    
    return Array.from(profilesMap.values()).sort((a, b) => 
      b.videoCount - a.videoCount // Sort by video count descending
    );
  };

  // Get Reza Pahlavi's profile picture
  const getRezaPahlaviProfile = (): string | null => {
    const profile = mediaItems.find(
      item => item.section === "Youtube_Channel_Profile_Picture" && item.person?.trim() === "Reza Pahlavi"
    );
    return profile?.url || null;
  };

  // Get profile picture for any person (searches all mediaItems; matches by normalized name)
  const getProfilePicture = (personName: string): string | null => {
    const key = normalizePerson(personName);
    const profile = mediaItems.find(
      item =>
        item.section === "Youtube_Channel_Profile_Picture" &&
        item.person &&
        normalizePerson(item.person) === key
    );
    return profile?.url || null;
  };

  // Get all videos for Reza Pahlavi (from any section/category)
  const getRezaPahlaviVideos = (): VideoItem[] => {
    return mediaItems
      .filter(item => {
        const url = item.url.toLowerCase();
        return url.includes(".mp4") && item.person?.trim() === "Reza Pahlavi";
      })
      .map(item => ({
        id: item.PK,
        thumbnail: item.url,
        url: item.url,
        title: item.title,
        personName: item.person,
        person: item.person,
        description: item.description,
        createdAt: item.createdAt,
        group: item.group,
      }));
  };

  // Get videos for a specific person, optionally filtered by category (person matched by normalized name)
  const getVideosByPerson = (personName: string, category?: string): VideoItem[] => {
    const personKey = normalizePerson(personName);
    return mediaItems
      .filter(item => {
        const url = (item.url ?? "").toLowerCase();
        if (!url.includes(".mp4")) return false;
        if (normalizePerson(item.person ?? "") !== personKey) return false;
        
        if (category) {
          const group = (item.group ?? "").trim();
          const isYoutubeVideos = isYoutubeVideoSection(item.section ?? "");
          if (category === "Political") {
            return isYoutubeVideos && group === "Political Analysis";
          } else if (category === "News") {
            return isYoutubeVideos && group.toLowerCase() === "news";
          }
        }
        
        return true;
      })
      .map(item => ({
        id: item.PK,
        thumbnail: item.url,
        url: item.url,
        title: item.title,
        personName: item.person,
        person: item.person,
        description: item.description,
        createdAt: item.createdAt,
        group: item.group,
      }));
  };

  const politicalProfiles = useMemo(() => getProfiles("Political"), [mediaItems]);
  const newsProfiles = useMemo(() => getProfiles("News"), [mediaItems]);

  const handleCardClick = (personName: string) => {
    setExpandedPerson((prev) => (prev === personName ? null : personName));
  };

  const handleVideoPlayOnCard = (personName: string, video: VideoItem) => {
    setActivePlayback("video-hub-card", `${personName}-${video.id}`);
    setPlayingVideoOnCard({ personName, video });
    setExpandedPerson(null);
  };

  const handleClearPlayingVideoOnCard = () => {
    setActivePlayback(null);
    setPlayingVideoOnCard(null);
  };

  const handleCloseModal = () => {
    setActivePlayback(null);
    setShowModal(false);
    setSelectedPerson(null);
    setModalPlayingVideo(null);
  };

  const handleVideoClickInModal = (video: VideoItem, playInModal: boolean) => {
    if (playInModal) {
      setActivePlayback("video-hub-modal", video.id);
      setModalPlayingVideo(video);
    } else {
      if (onVideoClick) onVideoClick(video);
    }
  };

  const openModalForPerson = (personName: string) => {
    setExpandedPerson(null);
    setSelectedPerson(personName);
    setShowModal(true);
    setModalPlayingVideo(null);
  };

  if (loading) {
    return (
      <section className="w-full">
        <div className="text-white text-center py-8">Loading videos...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="w-full">
        <div className="text-white text-center py-8">{error}</div>
      </section>
    );
  }

  return (
    <section className="w-full">
      {/* Dates and Mobile Navigation Section */}
      <div className="w-full flex flex-col md:flex-row items-center justify-between px-4 md:px-6 lg:px-8 py-4 md:py-6 gap-4 md:gap-0">
        {/* Mobile Navigation - Visible only on mobile */}
        <nav className="flex md:hidden items-center gap-4">
          <a
            href="#"
            className="text-white text-sm font-normal hover:opacity-80 transition-opacity underline decoration-white underline-offset-4"
          >
            Video Hub
          </a>
          <a
            href="#"
            className="text-white text-sm font-normal hover:opacity-80 transition-opacity"
          >
            Revolutionary Music
          </a>
          <a
            href="#"
            className="text-white text-sm font-normal hover:opacity-80 transition-opacity"
          >
            Video Submission
          </a>
        </nav>

        {/* Dates Display - sliding strip: Shamsi, Georgian (Farsi months), Shahanshahi */}
        <div className="flex flex-col items-end md:items-end text-right w-full md:w-auto" style={{ width: "100%" }}>
          <DateDisplay date={today} />
        </div>
      </div>

      {/* Video Hub Main Content – md:items-stretch so both columns always have the same height on large screens */}
      <div ref={hubContentRef} className="w-full flex flex-col md:flex-row gap-6 md:gap-8 px-4 md:px-6 lg:px-8 pb-8 md:items-stretch">
        {/* Your Favourite Section – stretches to match Video Hub column height */}
        <div className="w-full md:w-[400px] lg:w-[500px] xl:w-[560px] flex-shrink-0 flex flex-col order-1 md:order-2 md:min-h-0 min-w-0">
          <h2 className="text-white text-[24.64px] font-semibold leading-[1.5] mb-6 flex-shrink-0">Your Favourite</h2>
          <div className="flex-1 min-h-0 flex flex-col w-full max-w-[450px] lg:max-w-[520px] xl:max-w-[600px] overflow-hidden">
            <ProfileCardWithDropdown
              size="king"
              profile={{
                person: "Reza Pahlavi",
                pictureUrl: getRezaPahlaviProfile() ?? "",
              }}
              videos={getRezaPahlaviVideos()}
              onVideoClick={(video) => handleVideoPlayOnCard("Reza Pahlavi", video)}
              isExpanded={expandedPerson === "Reza Pahlavi"}
              onToggle={() => handleCardClick("Reza Pahlavi")}
              onViewAllClick={
                getRezaPahlaviVideos().length > 4
                  ? () => openModalForPerson("Reza Pahlavi")
                  : undefined
              }
              playingVideo={playingVideoOnCard?.personName === "Reza Pahlavi" ? playingVideoOnCard.video : null}
              onClearPlayingVideo={handleClearPlayingVideoOnCard}
            />
          </div>
        </div>

        {/* Recent Video Hub Section */}
        <div className="flex-1 w-full flex flex-col order-2 md:order-1 min-w-0">
          <h2 className="text-white text-[24.64px] font-semibold leading-[1.5] mb-6">Recent Video Hub</h2>
          <div className="flex flex-col gap-8">
            <ProfileRowWithNav
              label="Political"
              isEmpty={politicalProfiles.length === 0 && !loading}
              emptyMessage="No profiles available for Political"
            >
              {politicalProfiles.map((profile) => {
                const personVideos = getVideosByPerson(profile.person, "Political");
                return (
                  <div key={`Political-${profile.person}`} className="flex-shrink-0 w-[140px] md:w-[152px]">
                    <ProfileCardWithDropdown
                      profile={{
                        person: profile.person,
                        pictureUrl: profile.pictureUrl,
                      }}
                      videos={personVideos}
                      onVideoClick={(video) => handleVideoPlayOnCard(profile.person, video)}
                      isExpanded={expandedPerson === profile.person}
                      onToggle={() => handleCardClick(profile.person)}
                      onViewAllClick={
                        personVideos.length > 4
                          ? () => openModalForPerson(profile.person)
                          : undefined
                      }
                      playingVideo={playingVideoOnCard?.personName === profile.person ? playingVideoOnCard.video : null}
                      onClearPlayingVideo={handleClearPlayingVideoOnCard}
                    />
                  </div>
                );
              })}
            </ProfileRowWithNav>
            <ProfileRowWithNav
              label="News"
              isEmpty={newsProfiles.length === 0 && !loading}
              emptyMessage="No profiles available for News"
            >
              {newsProfiles.map((profile) => {
                const personVideos = getVideosByPerson(profile.person, "News");
                return (
                  <div key={`News-${profile.person}`} className="flex-shrink-0 w-[140px] md:w-[152px]">
                    <ProfileCardWithDropdown
                      profile={{
                        person: profile.person,
                        pictureUrl: profile.pictureUrl,
                      }}
                      videos={personVideos}
                      onVideoClick={(video) => handleVideoPlayOnCard(profile.person, video)}
                      isExpanded={expandedPerson === profile.person}
                      onToggle={() => handleCardClick(profile.person)}
                      onViewAllClick={
                        personVideos.length > 4
                          ? () => openModalForPerson(profile.person)
                          : undefined
                      }
                      playingVideo={playingVideoOnCard?.personName === profile.person ? playingVideoOnCard.video : null}
                      onClearPlayingVideo={handleClearPlayingVideoOnCard}
                    />
                  </div>
                );
              })}
            </ProfileRowWithNav>
          </div>
        </div>
      </div>

      {selectedPerson && (
        <PersonProfileModal
          isOpen={showModal}
          onClose={handleCloseModal}
          personName={selectedPerson}
          profilePictureUrl={
            selectedPerson === "Reza Pahlavi"
              ? getRezaPahlaviProfile() ?? ""
              : getProfilePicture(selectedPerson) ?? ""
          }
          videos={
            selectedPerson === "Reza Pahlavi"
              ? getRezaPahlaviVideos()
              : getVideosByPerson(selectedPerson)
          }
          onVideoClick={handleVideoClickInModal}
          playingVideo={modalPlayingVideo}
        />
      )}
    </section>
  );
}
