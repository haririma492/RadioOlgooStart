"use client";

import React, { useState } from "react";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import VideoSubmissionForm from "@/components/Forms/VideoSubmissionForm";
import SocialLinksForm from "@/components/Forms/SocialLinksForm";

type Lang = "fa" | "en";

const translations = {
  fa: {
    pageTitle: "همکاری با اُلگو",
    pageIntro: "برای مشارکت در رشد اُلگو، ویدئو یا پیوندهای شبکه‌های اجتماعی خود را از این بخش ارسال کنید.",
    submitVideo: "ارسال ویدئو",
    socialLinks: "شبکه‌های اجتماعی",
  },
  en: {
    pageTitle: "Contribute to Olgoo",
    pageIntro:
      "Use this page to contribute to Olgoo by submitting videos or sharing your social media links.",
    submitVideo: "Submit Video",
    socialLinks: "Social Links",
  },
};

export default function ContributePage() {
  const [lang, setLang] = useState<Lang>("fa");
  const isFa = lang === "fa";
  const t = translations[lang];

  const sectionTitleClass = isFa
    ? "mb-3 text-2xl font-bold tracking-normal"
    : "mb-3 text-xl font-bold tracking-normal";

  const panelClass =
    "mb-6 rounded-2xl border border-white/10 bg-black/90 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.35)]";

  return (
    <div
      dir={isFa ? "rtl" : "ltr"}
      className="min-h-screen text-white"
      style={{ backgroundColor: "#434343" }}
    >
      <Header />

      <main className="mx-auto w-full max-w-[1500px] px-4 py-8">
        <div className="mb-4 flex items-center justify-end">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/70 p-1">
            <button
              type="button"
              onClick={() => setLang("fa")}
              className={[
                "rounded-full px-5 py-2 font-semibold transition",
                isFa
                  ? "bg-white text-black shadow"
                  : "bg-transparent text-white/80 hover:bg-white/10",
                "text-base md:text-lg",
              ].join(" ")}
            >
              فارسی
            </button>

            <button
              type="button"
              onClick={() => setLang("en")}
              className={[
                "rounded-full px-5 py-2 font-semibold transition",
                !isFa
                  ? "bg-white text-black shadow"
                  : "bg-transparent text-white/80 hover:bg-white/10",
                "text-base md:text-lg",
              ].join(" ")}
            >
              English
            </button>
          </div>
        </div>

        <section className="mb-6 rounded-2xl bg-black/90 p-5 shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
          <h1 className={isFa ? "mb-3 text-3xl font-bold" : "mb-3 text-2xl font-bold"}>
            {t.pageTitle}
          </h1>
          <p className={isFa ? "text-lg leading-8 text-white/80" : "text-base leading-7 text-white/80"}>
            {t.pageIntro}
          </p>
        </section>

        <section className={panelClass}>
          <h2 className={sectionTitleClass}>{t.submitVideo}</h2>
          <VideoSubmissionForm />
        </section>

        <section className={panelClass}>
          <h2 className={sectionTitleClass}>{t.socialLinks}</h2>
          <SocialLinksForm />
        </section>
      </main>

      <Footer />
    </div>
  );
}