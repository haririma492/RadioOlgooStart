"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import VideoCategoryBar from "./VideoCategoryBar";
import ProfileCardWithDropdown from "./ProfileCardWithDropdown";
import PersonProfileModal from "./PersonProfileModal";

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
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("Political");
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalPlayingVideo, setModalPlayingVideo] = useState<VideoItem | null>(null);
  const hubContentRef = useRef<HTMLDivElement>(null);

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

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (hubContentRef.current && !hubContentRef.current.contains(target)) {
        setExpandedPerson(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Get profiles from Youtube_Channel_Profile_Picture section, filtered by category
  const getProfiles = (category?: string): Profile[] => {
    const profilesMap = new Map<string, { person: string; pictureUrl: string; videoCount: number }>();
    
    // First, find all profile pictures (exclude "Reza Pahlavi" - he goes in "Your Favourite")
    const profilePictures = mediaItems.filter(
      item => item.section === "Youtube_Channel_Profile_Picture" && item.person && item.person.trim() !== "Reza Pahlavi"
    );
    
    // Filter videos by category if specified
    let filteredVideos = mediaItems.filter(item => {
      const url = item.url.toLowerCase();
      // Check if it's a video file
      if (!url.includes(".mp4")) return false;
      // Skip videos without person (they can't be associated with profiles)
      if (!item.person || item.person.trim() === "") return false;
      // Exclude "Reza Pahlavi" - he goes in "Your Favourite"
      if (item.person.trim() === "Reza Pahlavi") return false;
      
      if (!category) return true;
      
      // Map category to section/group filters
      if (category === "Political") {
        return item.section === "Youtube Chanel Videos" && item.group === "Political Analysis";
      } else if (category === "Military") {
        // Military videos have section="Military" (group can be empty or any value)
        // OR old format: section="Youtube Chanel Videos" AND group="Military"
        return item.section === "Military" ||
          (item.section === "Youtube Chanel Videos" && item.group === "Military");
      }
      
      return false;
    });
    
    // Count videos per person for the filtered category
    const videoCounts = new Map<string, number>();
    filteredVideos.forEach(item => {
      const personName = item.person?.trim();
      if (personName) {
        videoCounts.set(personName, (videoCounts.get(personName) || 0) + 1);
      }
    });
    
    // Build profiles map - only include persons who have videos in the selected category
    profilePictures.forEach(item => {
      const personName = item.person?.trim();
      if (personName && videoCounts.has(personName)) {
        profilesMap.set(personName, {
          person: personName,
          pictureUrl: item.url,
          videoCount: videoCounts.get(personName) || 0,
        });
      }
    });
    
    // Also include persons who have videos in category but no profile picture
    // (exclude "Reza Pahlavi" - he goes in "Your Favourite")
    videoCounts.forEach((count, person) => {
      const personName = person.trim();
      if (personName !== "Reza Pahlavi" && !profilesMap.has(personName)) {
        profilesMap.set(personName, {
          person: personName,
          pictureUrl: '', // No picture available
          videoCount: count,
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

  // Get profile picture for any person (searches all mediaItems, not filtered by category)
  const getProfilePicture = (personName: string): string | null => {
    const profile = mediaItems.find(
      item => item.section === "Youtube_Channel_Profile_Picture" && item.person?.trim() === personName.trim()
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

  // Get videos for a specific person, optionally filtered by category
  const getVideosByPerson = (personName: string, category?: string): VideoItem[] => {
    const trimmedPersonName = personName.trim();
    return mediaItems
      .filter(item => {
        const url = item.url.toLowerCase();
        if (!url.includes(".mp4") || item.person?.trim() !== trimmedPersonName) return false;
        
        // Filter by category if specified
        if (category) {
          if (category === "Political") {
            return item.section === "Youtube Chanel Videos" && item.group === "Political Analysis";
          } else if (category === "Military") {
            // Military videos have section="Military" with empty group
            // OR old format: section="Youtube Chanel Videos" AND group="Military"
            return item.section === "Military" ||
              (item.section === "Youtube Chanel Videos" && item.group === "Military");
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

  // Filter videos by category (kept for other sections if needed)
  const filterVideos = (category: string): VideoItem[] => {
    return mediaItems
      .filter((item) => {
        const url = item.url.toLowerCase();
        if (!url.includes(".mp4")) return false;

        if (category === "Political Analysis") {
          return item.section === "Youtube Chanel Videos" && item.group === "Political Analysis";
        } else if (category === "Military") {
          return item.section === "Military" ||
            (item.section === "Youtube Chanel Videos" && item.group === "Military");
        }

        return false;
      })
      .slice(0, 10)
      .map((item) => ({
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
  const militaryProfiles = useMemo(() => getProfiles("Military"), [mediaItems]);

  const handleCardClick = (personName: string) => {
    setExpandedPerson((prev) => (prev === personName ? null : personName));
  };

  const handleVideoClickFromDropdown = (video: VideoItem) => {
    if (onVideoClick) onVideoClick(video);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedPerson(null);
    setModalPlayingVideo(null);
  };

  const handleVideoClickInModal = (video: VideoItem, playInModal: boolean) => {
    if (playInModal) {
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
            Audio Hub
          </a>
          <a
            href="#"
            className="text-white text-sm font-normal hover:opacity-80 transition-opacity"
          >
            Video Submission
          </a>
        </nav>

        {/* Dates Display - Right-aligned on desktop */}
        <div className="flex flex-col items-end md:items-end text-right w-full md:w-auto" style={{ width: '100%' }}>
          <div className="text-white text-sm md:text-base font-normal">
            Friday, January 30, 2026
          </div>
          <div className="text-white text-sm md:text-base font-normal">
            Friday, January 30, 2026
          </div>
          <div className="text-white text-sm md:text-base font-normal">
            Friday, 10 Bahman 1404
          </div>
        </div>
      </div>

      {/* Video Hub Main Content */}
      <div ref={hubContentRef} className="w-full flex flex-col md:flex-row gap-6 md:gap-8 px-4 md:px-6 lg:px-8 pb-8 items-start">
        {/* Your Favourite Section - First on mobile, Right on desktop */}
        <div className="w-full md:w-[400px] lg:w-[450px] flex-shrink-0 flex flex-col order-1 md:order-2">
          <h2 className="text-white text-[24.64px] font-semibold leading-[1.5] mb-6">Your Favourite</h2>
          <div className="w-full max-w-[280px]">
            <ProfileCardWithDropdown
              profile={{
                person: "Reza Pahlavi",
                pictureUrl: getRezaPahlaviProfile() ?? "",
              }}
              videos={getRezaPahlaviVideos()}
              onVideoClick={handleVideoClickFromDropdown}
              isExpanded={expandedPerson === "Reza Pahlavi"}
              onToggle={() => handleCardClick("Reza Pahlavi")}
              onViewAllClick={
                getRezaPahlaviVideos().length > 4
                  ? () => openModalForPerson("Reza Pahlavi")
                  : undefined
              }
            />
          </div>
        </div>

        {/* Recent Video Hub Section - Second on mobile, Left on desktop */}
        <div className="flex-1 w-full flex flex-col order-2 md:order-1">
          <h2 className="text-white text-[24.64px] font-semibold leading-[1.5] mb-6">Recent Video Hub</h2>
          <div className="flex gap-4 md:gap-6 lg:gap-8 overflow-visible">
            {/* Category Bar (Left) */}
            <VideoCategoryBar
              categories={["Political", "Military"]}
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
            />

            {/* Profile Cards Grid (Right) - Show both categories */}
            <div className="flex-1 space-y-8">
              {/* Political Cards */}
              <div>
               
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                  {politicalProfiles.map((profile) => {
                    const personVideos = getVideosByPerson(profile.person);
                    return (
                      <ProfileCardWithDropdown
                        key={`Political-${profile.person}`}
                        profile={{
                          person: profile.person,
                          pictureUrl: profile.pictureUrl,
                        }}
                        videos={personVideos}
                        onVideoClick={handleVideoClickFromDropdown}
                        isExpanded={expandedPerson === profile.person}
                        onToggle={() => handleCardClick(profile.person)}
                        onViewAllClick={
                          personVideos.length > 4
                            ? () => openModalForPerson(profile.person)
                            : undefined
                        }
                      />
                    );
                  })}
                  {politicalProfiles.length === 0 && !loading && (
                    <div className="col-span-full text-white/60 text-center py-4">
                      No profiles available for Political
                    </div>
                  )}
                </div>
              </div>

              {/* Military Cards */}
              <div>
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                  {militaryProfiles.map((profile) => {
                    const personVideos = getVideosByPerson(profile.person);
                    return (
                      <ProfileCardWithDropdown
                        key={`Military-${profile.person}`}
                        profile={{
                          person: profile.person,
                          pictureUrl: profile.pictureUrl,
                        }}
                        videos={personVideos}
                        onVideoClick={handleVideoClickFromDropdown}
                        isExpanded={expandedPerson === profile.person}
                        onToggle={() => handleCardClick(profile.person)}
                        onViewAllClick={
                          personVideos.length > 4
                            ? () => openModalForPerson(profile.person)
                            : undefined
                        }
                      />
                    );
                  })}
                  {militaryProfiles.length === 0 && !loading && (
                    <div className="col-span-full text-white/60 text-center py-4">
                      No profiles available for Military
                    </div>
                  )}
                </div>
              </div>
            </div>
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
