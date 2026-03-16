"use client";

import { useLanguage } from "@/context/LanguageContext";
import { translations } from "@/lib/i18n/translations";

export default function LanguageSwitch() {
  const { lang, toggleLang } = useLanguage();

  return (
    <button
      onClick={toggleLang}
      className="rounded-md border border-neutral-500 px-3 py-1 text-sm hover:bg-neutral-700"
    >
      {translations[lang].languageToggle}
    </button>
  );
}