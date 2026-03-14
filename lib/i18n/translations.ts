export type Lang = "fa" | "en";

export type TranslationSet = {
  olgooLive: string;
  liveChannels: string;
  videoHub: string;
  music: string;
  submitVideo: string;
  socialLinks: string;
  breakingNews: string;
  languageToggle: string;
};

export const translations: Record<Lang, TranslationSet> = {
  fa: {
    olgooLive: "پخش زنده اُلگو",
    liveChannels: "کانال‌های زنده",
    videoHub: "آرشیو ویدئو",
    music: "موسیقی میهنی",
    submitVideo: "ارسال ویدئو",
    socialLinks: "شبکه‌های اجتماعی",
    breakingNews: "خبر فوری",
    languageToggle: "EN",
  },
  en: {
    olgooLive: "Olgoo Live",
    liveChannels: "Live Channels",
    videoHub: "Video Hub",
    music: "Revolutionary Music",
    submitVideo: "Submit Video",
    socialLinks: "Social Links",
    breakingNews: "Breaking News",
    languageToggle: "فارسی",
  },
};

export default translations;