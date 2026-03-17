"use client";

import React, { createContext, useContext, useState } from "react";
import { Lang } from "@/lib/i18n/translations";

type LangContextType = {
  lang: Lang;
  toggleLang: () => void;
};

const LanguageContext = createContext<LangContextType | null>(null);

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [lang, setLang] = useState<Lang>("fa");

  const toggleLang = () => {
    setLang((prev) => (prev === "fa" ? "en" : "fa"));
  };

  return (
    <LanguageContext.Provider value={{ lang, toggleLang }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
};