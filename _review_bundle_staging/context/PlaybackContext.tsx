"use client";

import React, { createContext, useCallback, useContext, useState } from "react";

export type ActivePlayback = {
  source: string;
  id: string;
} | null;

type PlaybackContextValue = {
  activePlayback: ActivePlayback;
  setActivePlayback: (source: string | null, id?: string | null) => void;
};

const PlaybackContext = createContext<PlaybackContextValue | null>(null);

export function PlaybackProvider({ children }: { children: React.ReactNode }) {
  const [activePlayback, setState] = useState<ActivePlayback>(null);

  const setActivePlayback = useCallback((source: string | null, id?: string | null) => {
    if (source === null) {
      setState(null);
    } else {
      setState({ source, id: id ?? "" });
    }
  }, []);

  return (
    <PlaybackContext.Provider value={{ activePlayback, setActivePlayback }}>
      {children}
    </PlaybackContext.Provider>
  );
}

export function usePlayback() {
  const ctx = useContext(PlaybackContext);
  if (!ctx) {
    throw new Error("usePlayback must be used within a PlaybackProvider");
  }
  return ctx;
}
