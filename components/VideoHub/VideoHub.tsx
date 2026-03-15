"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import ProfileCardWithDropdown from "./ProfileCardWithDropdown";
import PersonProfileModal from "./PersonProfileModal";
import SearchModal from "./SearchModal";
import ProfileRowWithNav from "./ProfileRowWithNav";
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
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [playingVideoOnCard, setPlayingVideoOnCard] = useState<{
    cardKey: string;
    personName: string;
    video: VideoItem;
  } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [modalPlayingVideo, setModalPlayingVideo] = useState<VideoItem | null>(null);
  const [isFaPage, setIsFaPage] = useState(false);
  const hubContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.getElementById("user-page");
    setIsFaPage(root?.getAttribute("dir") === "rtl");
  }, []);

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

  useEffect(() => {
    if (!activePlayback) return;
    const cardId = playingVideoOnCard
      ? `${playingVideoOnCard.cardKey}-${playingVideoOnCard.video.id}`
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

  const normalizePerson = (name: string): string =>
    (name ?? "").trim().toLowerCase().replace(/\s+/g, " ").replace(/\s/g, "");

  const isYoutubeVideoSection = (section: string): boolean => {
    const sn = (section ?? "").trim().toLowerCase().replace(/\s+/g, " ");
    return sn === "youtube chanel videos" || sn === "youtube channel videos";
  };

  const normalizeGroup = (group: string): string => (group ?? "").trim().toLowerCase();

  const toVideoItem = (item: MediaItem): VideoItem => ({
    id: item.PK,
    thumbnail: item.url,
    url: item.url,
    title: item.title,
    personName: item.person,
    person: item.person,
    description: item.description,
    createdAt: item.createdAt,
    group: item.group,
  });

  const mediaVideoItems = useMemo(() => {
    return mediaItems.filter((item) => {
      const url = (item.url ?? "").toLowerCase();
      return url.includes(".mp4");
    });
  }, [mediaItems]);

  const rezaProfilePicture = useMemo(() => {
    const profile = mediaItems.find(
      (item) =>
        item.section === "Youtube_Channel_Profile_Picture" &&
        item.person?.trim() === "Reza Pahlavi"
    );
    return profile?.url || null;
  }, [mediaItems]);

  const profilePictureByPerson = useMemo(() => {
    const map = new Map<string, string>();

    mediaItems.forEach((item) => {
      if (item.section !== "Youtube_Channel_Profile_Picture") return;
      const personName = item.person?.trim();
      if (!personName) return;

      const key = normalizePerson(personName);
      if (!map.has(key) && item.url) {
        map.set(key, item.url);
      }
    });

    return map;
  }, [mediaItems]);

  const rezaVideos = useMemo(() => {
    return mediaVideoItems
      .filter((item) => item.person?.trim() === "Reza Pahlavi")
      .map(toVideoItem);
  }, [mediaVideoItems]);

  const videosByPersonAndGroup = useMemo(() => {
    const map = new Map<string, VideoItem[]>();

    mediaVideoItems.forEach((item) => {
      const personName = item.person?.trim();
      if (!personName) return;

      const personKey = normalizePerson(personName);
      const groupName = (item.group ?? "").trim();

      const allKey = `${personKey}__ALL`;
      const currentAll = map.get(allKey) ?? [];
      currentAll.push(toVideoItem(item));
      map.set(allKey, currentAll);

      if (groupName && isYoutubeVideoSection(item.section ?? "")) {
        const groupKey = `${personKey}__${normalizeGroup(groupName)}`;
        const currentGroup = map.get(groupKey) ?? [];
        currentGroup.push(toVideoItem(item));
        map.set(groupKey, currentGroup);
      }
    });

    return map;
  }, [mediaVideoItems]);

  const youtubeGroupNames = useMemo(() => {
    const groups = new Set<string>();

    mediaItems.forEach((item) => {
      const isVideoFile = (item.url ?? "").toLowerCase().includes(".mp4");
      const hasPerson = !!item.person?.trim();
      const isRezaPahlavi = item.person?.trim() === "Reza Pahlavi";

      if (!isVideoFile || !hasPerson || isRezaPahlavi) return;
      if (!isYoutubeVideoSection(item.section ?? "")) return;

      const groupName = (item.group ?? "").trim();
      if (!groupName) return;

      groups.add(groupName);
    });

    return Array.from(groups).sort((a, b) => a.localeCompare(b));
  }, [mediaItems]);

  const profilesByGroup = useMemo(() => {
    const result = new Map<string, Profile[]>();

    youtubeGroupNames.forEach((groupName) => {
      const normalizedWantedGroup = normalizeGroup(groupName);

      const videoCountsByNormalized = new Map<
        string,
        { count: number; displayName: string }
      >();

      mediaItems.forEach((item) => {
        const url = (item.url ?? "").toLowerCase();
        if (!url.includes(".mp4")) return;
        if (!item.person || item.person.trim() === "") return;
        if (item.person.trim() === "Reza Pahlavi") return;
        if (!isYoutubeVideoSection(item.section ?? "")) return;

        const currentGroup = (item.group ?? "").trim();
        if (!currentGroup) return;
        if (normalizeGroup(currentGroup) !== normalizedWantedGroup) return;

        const personName = item.person.trim();
        const key = normalizePerson(personName);
        const existing = videoCountsByNormalized.get(key);

        if (existing) {
          existing.count += 1;
        } else {
          videoCountsByNormalized.set(key, {
            count: 1,
            displayName: personName,
          });
        }
      });

      const profilesMap = new Map<string, Profile>();

      videoCountsByNormalized.forEach((entry, key) => {
        profilesMap.set(key, {
          person: entry.displayName,
          pictureUrl: profilePictureByPerson.get(key) ?? "",
          videoCount: entry.count,
        });
      });

      result.set(
        groupName,
        Array.from(profilesMap.values()).sort((a, b) => b.videoCount - a.videoCount)
      );
    });

    return result;
  }, [youtubeGroupNames, mediaItems, profilePictureByPerson]);

  const getProfilePicture = (personName: string): string | null => {
    return profilePictureByPerson.get(normalizePerson(personName)) ?? null;
  };

  const getVideosByPerson = (personName: string, groupName?: string): VideoItem[] => {
    const personKey = normalizePerson(personName);
    const key = groupName
      ? `${personKey}__${normalizeGroup(groupName)}`
      : `${personKey}__ALL`;

    return videosByPersonAndGroup.get(key) ?? [];
  };

  const handleCardClick = (personName: string) => {
    setExpandedPerson((prev) => (prev === personName ? null : personName));
  };

  const handleVideoPlayOnCard = (
    cardKey: string,
    personName: string,
    video: VideoItem
  ) => {
    setActivePlayback("video-hub-card", `${cardKey}-${video.id}`);
    setPlayingVideoOnCard({ cardKey, personName, video });
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
    setSelectedGroup(null);
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

  const openModalForPerson = (personName: string, groupName?: string) => {
    setExpandedPerson(null);
    setSelectedPerson(personName);
    setSelectedGroup(groupName ?? null);
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
      <div className="w-full flex flex-col md:flex-row items-center justify-between px-4 md:px-6 lg:px-8 py-4 md:py-6 gap-4 md:gap-0">
        <nav className="flex md:hidden items-center gap-4">
          <a
            href="#video-hub"
            className="text-white text-sm font-normal hover:opacity-80 transition-opacity underline decoration-white underline-offset-4"
          >
            Video Hub
          </a>
          <a
            href="#revolutionary-music"
            className="text-white text-sm font-normal hover:opacity-80 transition-opacity"
          >
            Revolutionary Music
          </a>
          <a
            href="#video-submission"
            className="text-white text-sm font-normal hover:opacity-80 transition-opacity"
          >
            Video Submission
          </a>
        </nav>
      </div>

      <div
        ref={hubContentRef}
        className="w-full flex flex-col md:flex-row gap-6 md:gap-8 px-4 md:px-6 lg:px-8 pb-8 md:items-stretch"
      >
        <div className="w-full md:w-[400px] lg:w-[500px] xl:w-[560px] flex-shrink-0 flex flex-col order-1 md:order-2 md:min-h-0 min-w-0">
          {!isFaPage && (
            <h2 className="text-white text-[24.64px] font-semibold leading-[1.5] mb-6">
              Your Favourite
            </h2>
          )}

          <div className="flex-1 min-h-0 flex flex-col w-full max-w-[360px] lg:max-w-[440px] xl:max-w-[510px] overflow-hidden">
            <ProfileCardWithDropdown
              size="king"
              profile={{
                person: "Reza Pahlavi",
                pictureUrl: rezaProfilePicture ?? "",
              }}
              videos={rezaVideos}
              onVideoClick={(video) =>
                handleVideoPlayOnCard("Reza Pahlavi", "Reza Pahlavi", video)
              }
              isExpanded={expandedPerson === "Reza Pahlavi"}
              onToggle={() => handleCardClick("Reza Pahlavi")}
              onViewAllClick={
                rezaVideos.length > 4 ? () => openModalForPerson("Reza Pahlavi") : undefined
              }
              onSearchClick={() => setShowSearchModal(true)}
              playingVideo={
                playingVideoOnCard?.cardKey === "Reza Pahlavi"
                  ? playingVideoOnCard.video
                  : null
              }
              onClearPlayingVideo={handleClearPlayingVideoOnCard}
            />
          </div>
        </div>

        <div className="flex-1 w-full flex flex-col order-2 md:order-1 min-w-0">
          {!isFaPage && (
            <h2 className="text-white text-[24.64px] font-semibold leading-[1.5] mb-6">
              Recent Video Hub
            </h2>
          )}

          <div className="flex flex-col gap-8">
            {youtubeGroupNames.length === 0 ? (
              <div className="text-white/60 text-center py-8 w-full">
                No profiles available for Youtube Chanel Videos
              </div>
            ) : (
              youtubeGroupNames.map((groupName) => {
                const groupProfiles = profilesByGroup.get(groupName) ?? [];

                return (
                  <ProfileRowWithNav
                    key={groupName}
                    label={groupName}
                    isEmpty={groupProfiles.length === 0 && !loading}
                    emptyMessage={`No profiles available for ${groupName}`}
                  >
                    {groupProfiles.map((profile) => {
                      const personVideos = getVideosByPerson(profile.person, groupName);
                      const cardKey = `${groupName}-${profile.person}`;

                      return (
                        <div key={cardKey} className="flex-shrink-0 w-[140px] md:w-[152px]">
                          <ProfileCardWithDropdown
                            profile={{
                              person: profile.person,
                              pictureUrl: profile.pictureUrl,
                            }}
                            videos={personVideos}
                            onVideoClick={(video) =>
                              handleVideoPlayOnCard(cardKey, profile.person, video)
                            }
                            isExpanded={expandedPerson === cardKey}
                            onToggle={() => handleCardClick(cardKey)}
                            onViewAllClick={
                              personVideos.length > 4
                                ? () => openModalForPerson(profile.person, groupName)
                                : undefined
                            }
                            onSearchClick={() => setShowSearchModal(true)}
                            playingVideo={
                              playingVideoOnCard?.cardKey === cardKey
                                ? playingVideoOnCard.video
                                : null
                            }
                            onClearPlayingVideo={handleClearPlayingVideoOnCard}
                          />
                        </div>
                      );
                    })}
                  </ProfileRowWithNav>
                );
              })
            )}
          </div>
        </div>
      </div>

      <SearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
      />

      {selectedPerson && (
        <PersonProfileModal
          isOpen={showModal}
          onClose={handleCloseModal}
          personName={selectedPerson}
          profilePictureUrl={
            selectedPerson === "Reza Pahlavi"
              ? rezaProfilePicture ?? ""
              : getProfilePicture(selectedPerson) ?? ""
          }
          videos={
            selectedPerson === "Reza Pahlavi"
              ? rezaVideos
              : getVideosByPerson(selectedPerson, selectedGroup ?? undefined)
          }
          onVideoClick={handleVideoClickInModal}
          playingVideo={modalPlayingVideo}
        />
      )}
    </section>
  );
}