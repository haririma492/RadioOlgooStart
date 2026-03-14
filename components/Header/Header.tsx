"use client";

import React from "react";

type Lang = "fa" | "en";

type HeaderProps = {
  lang: Lang;
  setLang: (lang: Lang) => void;
};

export default function Header({ lang, setLang }: HeaderProps) {
  const isFa = lang === "fa";

  const headerTitle = isFa
    ? "ایستگاه دیداری-شنیداری انقلاب شیر و خورشید و تمدن ایرانی"
    : "A Video Hub of Iranian Civilization and Lion and Sun Revolution";

  return (
    <header
      dir="ltr"
      className="relative w-full z-50"
      style={{
        background: "linear-gradient(135deg, #0d0a05 0%, #1a1005 50%, #0d0a05 100%)",
        borderBottom: "1px solid rgba(197, 155, 65, 0.25)",
        boxShadow: "0 2px 24px rgba(0,0,0,0.8), 0 1px 0 rgba(197,155,65,0.1)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "2px",
          background:
            "linear-gradient(90deg, transparent 0%, #c59b41 30%, #e8c96b 50%, #c59b41 70%, transparent 100%)",
        }}
      />

      <div
        className="relative flex flex-row items-center justify-between px-4 md:px-8 lg:px-12"
        style={{ height: "72px" }}
      >
        <div className="flex-shrink-0 flex items-center md:hidden">
          <img
            src="/images/newheaderlogo26feb.jpg"
            alt="Radio Olgoo – Echo of Iranian Civilization"
            className="h-14 w-auto object-contain rounded-lg"
            style={{ filter: "drop-shadow(0 0 8px rgba(197,155,65,0.4))" }}
          />
        </div>

        <div className="hidden md:block flex-1 min-w-0" aria-hidden />

        <div
          className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center justify-center pointer-events-none"
          style={{
            width: "min(980px, 66vw)",
            textAlign: "center",
          }}
        >
          <div
            dir={isFa ? "rtl" : "ltr"}
            style={{
              fontFamily: isFa ? "Vazirmatn, sans-serif" : "inherit",
              color: "#e8c96b",
              fontSize: isFa ? "22px" : "19px",
              fontWeight: isFa ? 600 : 700,
              letterSpacing: isFa ? "0.01em" : "0.03em",
              lineHeight: 1.25,
              textShadow:
                "0 0 10px rgba(197,155,65,0.28), 0 0 24px rgba(197,155,65,0.14)",
              whiteSpace: "nowrap",
            }}
          >
            {headerTitle}
          </div>
        </div>

        <div className="flex flex-row items-center gap-3 flex-shrink-0" dir="ltr">
          <div
            className="inline-flex items-center rounded-full overflow-hidden"
            style={{
              border: "1px solid rgba(197,155,65,0.28)",
              background: "rgba(255,255,255,0.04)",
              backdropFilter: "blur(8px)",
            }}
          >
            <button
              type="button"
              onClick={() => setLang("en")}
              className="px-3 py-1.5 text-xs md:text-sm font-semibold transition"
              style={{
                color: !isFa ? "#111111" : "#e8c96b",
                background: !isFa ? "#f3f0e8" : "transparent",
                minWidth: "54px",
              }}
            >
              EN
            </button>

            <div
              style={{
                width: "1px",
                height: "18px",
                background: "rgba(197,155,65,0.22)",
              }}
            />

            <button
              type="button"
              onClick={() => setLang("fa")}
              className="px-3 py-1.5 text-xs md:text-sm font-semibold transition"
              style={{
                color: isFa ? "#111111" : "#e8c96b",
                background: isFa ? "#f3f0e8" : "transparent",
                minWidth: "64px",
              }}
            >
              فارسی
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}