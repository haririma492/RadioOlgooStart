"use client";

import React, { useState, useEffect } from "react";

type Platform = "instagram" | "website" | "youtube" | "x";

type SocialLinksFormData = {
  [key in Platform]: string[];
};

type EnterFieldData = {
  [key in Platform]: string;
};

const PLATFORMS: { key: Platform; label: string; placeholder: string }[] = [
  { key: "instagram", label: "Instagram", placeholder: "instagram.com/links/links" },
  { key: "website", label: "Website", placeholder: "website.com/links" },
  { key: "youtube", label: "Youtube Channels", placeholder: "youtube.com/links" },
  { key: "x", label: "X Profiles", placeholder: "xprofile.com/links" },
];

export default function SocialLinksForm() {
  const [formData, setFormData] = useState<SocialLinksFormData>({
    instagram: Array(5).fill(""),
    website: Array(5).fill(""),
    youtube: Array(5).fill(""),
    x: Array(5).fill(""),
  });

  const [enterFields, setEnterFields] = useState<EnterFieldData>({
    instagram: "",
    website: "",
    youtube: "",
    x: "",
  });

  const [isSubmitting, setIsSubmitting] = useState<{ [key in Platform]?: boolean }>({});
  const [currentMobileIndex, setCurrentMobileIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleNext = () => {
    setCurrentMobileIndex((prev) => (prev + 1) % PLATFORMS.length);
  };

  const handlePrev = () => {
    setCurrentMobileIndex((prev) => (prev - 1 + PLATFORMS.length) % PLATFORMS.length);
  };

  const handleLinkChange = (platform: Platform, index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      [platform]: prev[platform].map((link, i) => i === index ? value : link),
    }));
  };

  const handleEnterChange = (platform: Platform, value: string) => {
    setEnterFields(prev => ({
      ...prev,
      [platform]: value,
    }));
  };

  const handleAddLink = (platform: Platform) => {
    if (enterFields[platform].trim()) {
      setFormData(prev => ({
        ...prev,
        [platform]: [...prev[platform].slice(1), enterFields[platform]], // Remove first, add new at end
      }));
      setEnterFields(prev => ({
        ...prev,
        [platform]: "",
      }));
    }
  };

  const handleSubmit = (platform: Platform) => {
    setIsSubmitting(prev => ({ ...prev, [platform]: true }));

    // Form submission logic
    console.log(`Submit ${platform}:`, formData[platform]);

    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(prev => ({ ...prev, [platform]: false }));
      alert(`${platform} links submitted successfully!`);
    }, 1000);
  };

  return (
    <section className="w-full py-12 md:py-16 lg:py-20">
      <div className="w-full px-4 md:px-6 lg:px-8">
        <div
          className="mx-auto relative"
          style={{
            borderRadius: '24px',
            background: '#FFFFFF29',
            backdropFilter: 'blur(36.974998474121094px)',
            padding: isMobile ? '24px 20px' : '40px 32px',
          }}
        >
          {/* Mobile: Single Card Carousel */}
          <div
            className="md:hidden relative overflow-hidden"
          >
            <div
              className="flex transition-transform duration-300 ease-in-out"
              style={{
                transform: `translateX(-${currentMobileIndex * 100}%)`,
              }}
            >
              {PLATFORMS.map((platform) => (
                <div
                  key={platform.key}
                  className="flex flex-col w-full min-w-full flex-shrink-0"
                  style={{
                    padding: '0 48px',
                  }}
                >
                  {/* Header Button - Mobile */}
                  <button
                    type="button"
                    className="w-full text-[#1a1a1a] font-semibold mb-4"
                    style={{
                      height: '52px',
                      borderRadius: '8px',
                      backgroundColor: '#FFFFFF',
                      opacity: 1,
                      padding: '8px',
                      fontSize: '14px',
                    }}
                  >
                    {platform.label}
                  </button>

                  {/* 5 Link Input Fields - Mobile */}
                  <div className="space-y-2 mb-4">
                    {formData[platform.key].map((link, index) => (
                      <div key={index} className="relative">
                        <input
                          type="text"
                          value={link}
                          onChange={(e) => handleLinkChange(platform.key, index, e.target.value)}
                          placeholder={platform.placeholder}
                          className="w-full text-white text-center bg-white/10 border border-white/20 focus:outline-none focus:border-white/40 placeholder:text-white/60"
                          style={{
                            height: '48px',
                            borderRadius: '12px',
                            paddingTop: '12px',
                            paddingRight: 'calc(24px + 24px)',
                            paddingBottom: '12px',
                            paddingLeft: '24px',
                            borderWidth: '1px',
                            borderStyle: 'solid',
                            opacity: 1,
                            fontSize: '12px',
                          }}
                        />
                        {/* Send Icon - Mobile */}
                        <div
                          className="absolute pointer-events-none"
                          style={{
                            right: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                          }}
                        >
                          <img
                            src="/svg/send.svg"
                            alt="Send"
                            style={{
                              width: '16px',
                              height: '16px',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Bottom Section: Enter Field and Submit Button - Mobile */}
                  <div className="mt-auto grid gap-2" style={{ gridTemplateColumns: '1fr auto' }}>
                    {/* Enter Input Field - Mobile */}
                    <input
                      type="text"
                      value={enterFields[platform.key]}
                      onChange={(e) => handleEnterChange(platform.key, e.target.value)}
                      placeholder="Enter"
                      className="w-full text-white text-center bg-white/10 border border-white/20 focus:outline-none focus:border-white/40 placeholder:text-white/60"
                      style={{
                        height: '44px',
                        borderRadius: '12px',
                        paddingTop: '12px',
                        paddingRight: '20px',
                        paddingBottom: '12px',
                        paddingLeft: '20px',
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        opacity: 1,
                        fontSize: '12px',
                      }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleAddLink(platform.key);
                        }
                      }}
                    />

                    {/* Submit Button - Mobile */}
                    <button
                      type="button"
                      onClick={() => handleSubmit(platform.key)}
                      disabled={isSubmitting[platform.key]}
                      className="text-[#1a1a1a] font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      style={{
                        height: '44px',
                        borderRadius: '46px',
                        backgroundColor: '#FFFFFF',
                        paddingTop: '12px',
                        paddingRight: '24px',
                        paddingBottom: '12px',
                        paddingLeft: '24px',
                        opacity: 1,
                        fontSize: '12px',
                      }}
                    >
                      {isSubmitting[platform.key] ? 'Submitting...' : 'Submit'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Mobile Navigation Arrow - Right */}
            {currentMobileIndex < PLATFORMS.length - 1 && (
              <button
                onClick={handleNext}
                className="absolute top-1/2 -translate-y-1/2 z-10 bg-white/20 rounded-full p-2 hover:opacity-80 transition-opacity"
                style={{
                  right: '0px',
                  backdropFilter: 'blur(10px)',
                }}
              >
                <img
                  src="/svg/nexticon.svg"
                  alt="Next"
                  className="w-5 h-5"
                />
              </button>
            )}

            {/* Mobile Navigation Arrow - Left */}
            {currentMobileIndex > 0 && (
              <button
                onClick={handlePrev}
                className="absolute top-1/2 -translate-y-1/2 z-10 bg-white/20 rounded-full p-2 hover:opacity-80 transition-opacity rotate-180"
                style={{
                  left: '0px',
                  backdropFilter: 'blur(10px)',
                }}
              >
                <img
                  src="/svg/nexticon.svg"
                  alt="Previous"
                  className="w-5 h-5"
                />
              </button>
            )}
          </div>

          {/* Desktop: 4 Columns Grid Layout */}
          <div className="hidden md:grid grid-cols-4 gap-0">
            {PLATFORMS.map((platform, colIndex) => (
              <div
                key={platform.key}
                className="flex flex-col"
                style={{
                  borderRight: colIndex < PLATFORMS.length - 1 ? '1px solid rgba(255, 255, 255, 0.12)' : 'none',
                  padding: '0 16px',
                }}
              >
                {/* Header Button */}
                <button
                  type="button"
                  className="w-full text-[#1a1a1a] font-semibold mb-6"
                  style={{
                    height: '62px',
                    borderRadius: '8px',
                    backgroundColor: '#FFFFFF',
                    opacity: 1,
                    padding: '10px',
                  }}
                >
                  {platform.label}
                </button>

                {/* 5 Link Input Fields */}
                <div className="space-y-3 mb-6">
                  {formData[platform.key].map((link, index) => (
                    <div key={index} className="relative">
                      <input
                        type="text"
                        value={link}
                        onChange={(e) => handleLinkChange(platform.key, index, e.target.value)}
                        placeholder={platform.placeholder}
                        className="w-full text-white text-center bg-white/10 border border-white/20 focus:outline-none focus:border-white/40 placeholder:text-white/60"
                        style={{
                          height: '56px',
                          borderRadius: '12px',
                          paddingTop: '16px',
                          paddingRight: 'calc(32px + 28px)', // Space for send icon
                          paddingBottom: '16px',
                          paddingLeft: '32px',
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          opacity: 1,
                        }}
                      />
                      {/* Send Icon */}
                      <div
                        className="absolute pointer-events-none"
                        style={{
                          right: '16px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                        }}
                      >
                        <img
                          src="/svg/send.svg"
                          alt="Send"
                          style={{
                            width: '20px',
                            height: '20px',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom Section: Enter Field and Submit Button - Side by Side */}
                <div className="mt-auto grid gap-3" style={{ gridTemplateColumns: '1fr auto' }}>
                  {/* Enter Input Field */}
                  <input
                    type="text"
                    value={enterFields[platform.key]}
                    onChange={(e) => handleEnterChange(platform.key, e.target.value)}
                    placeholder="Enter"
                    className="w-full text-white text-center bg-white/10 border border-white/20 focus:outline-none focus:border-white/40 placeholder:text-white/60"
                    style={{
                      height: '56px',
                      borderRadius: '12px',
                      paddingTop: '16px',
                      paddingRight: '32px',
                      paddingBottom: '16px',
                      paddingLeft: '32px',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      opacity: 1,
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleAddLink(platform.key);
                      }
                    }}
                  />

                  {/* Submit Button */}
                  <button
                    type="button"
                    onClick={() => handleSubmit(platform.key)}
                    disabled={isSubmitting[platform.key]}
                    className="w-full text-[#1a1a1a] font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      height: '55px',
                      borderRadius: '46px',
                      backgroundColor: '#FFFFFF',
                      paddingTop: '16px',
                      paddingRight: '32px',
                      paddingBottom: '16px',
                      paddingLeft: '32px',
                      opacity: 1,
                    }}
                  >
                    {isSubmitting[platform.key] ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
