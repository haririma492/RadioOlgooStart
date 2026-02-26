"use client";

import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";

type VideoSubmissionFormData = {
  category: string;
  opinion: string;
  url: string;
  username: string;
  email: string;
};

type FormErrors = {
  category?: string;
  email?: string;
  url?: string;
};

const fieldStyle = {
  height: "56px",
  borderRadius: "12px",
  paddingTop: "16px",
  paddingRight: "32px",
  paddingBottom: "16px",
  paddingLeft: "32px",
  borderWidth: "1px",
  borderStyle: "solid" as const,
  opacity: 1,
};

export default function VideoSubmissionForm() {
  const [formData, setFormData] = useState<VideoSubmissionFormData>({
    category: "",
    opinion: "",
    url: "",
    username: "",
    email: "",
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownMobileStyle, setDropdownMobileStyle] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const categoryTriggerRef = useRef<HTMLDivElement>(null);
  const categoryButtonRef = useRef<HTMLButtonElement>(null); // the actual "Select Category" button - we measure this
  const dropdownRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Click outside to close dropdown (mobile + desktop)
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        categoryTriggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      )
        return;
      setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  const updateDropdownMobilePosition = React.useCallback(() => {
    // Measure the actual "Select Category" button so we never use the wrong element
    const el = categoryButtonRef.current;
    if (!isMobile || typeof window === "undefined" || !el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const pad = 8;
    let left = rect.left;
    let width = rect.width;
    if (left < pad) {
      width = width + (left - pad);
      left = pad;
    }
    if (left + width > vw - pad) {
      width = vw - left - pad;
    }
    width = Math.max(width, 100);
    setDropdownMobileStyle({
      top: rect.bottom + 8,
      left,
      width,
    });
  }, [isMobile]);

  // On mobile, set dropdown position/size from trigger so it sits exactly beneath and matches the field
  useLayoutEffect(() => {
    if (!dropdownOpen || !isMobile) return;
    updateDropdownMobilePosition();
  }, [dropdownOpen, isMobile, updateDropdownMobilePosition]);

  // On mobile, keep dropdown under trigger when user scrolls
  useEffect(() => {
    if (!dropdownOpen || !isMobile) return;
    window.addEventListener("scroll", updateDropdownMobilePosition, true);
    return () => window.removeEventListener("scroll", updateDropdownMobilePosition, true);
  }, [dropdownOpen, isMobile, updateDropdownMobilePosition]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateURL = (url: string): boolean => {
    if (!url) return true; // URL is optional
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Category is required
    if (!formData.category.trim()) {
      newErrors.category = "Please select a category";
    }

    // Email is required and must be valid
    if (!formData.email.trim()) {
      newErrors.email = "Email/social account is required";
    } else if (!validateEmail(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    // URL is optional but must be valid if provided
    if (formData.url.trim() && !validateURL(formData.url)) {
      newErrors.url = "Please enter a valid URL";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    // Form submission logic
    console.log("Form submitted:", formData);

    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      // Reset form or show success message
      alert("Form submitted successfully!");
      setFormData({
        category: "",
        opinion: "",
        url: "",
        username: "",
        email: "",
      });
    }, 1000);
  };

  const categories = [
    "Category 1",
    "Category 2",
    "Category 3",
    "Category 4",
    "Category 5",
  ];

  return (
    <section className="w-full py-12 md:py-16 lg:py-20">
      <div className="w-full px-4 md:px-6 lg:px-8">
        <form
          onSubmit={handleSubmit}
          className="mx-auto w-full"
          style={{
            borderRadius: '24px',
            background: '#FFFFFF29',
            backdropFilter: 'blur(36.974998474121094px)',
            padding: isMobile ? '32px 20px' : '52px 48px',
            minHeight: isMobile ? '560px' : 'auto',
          }}
        >
          {/* Form Title - smaller on mobile */}
          <p
            className="text-white mb-8 md:mb-10 text-center"
            style={{
              fontFamily: 'Urbanist, sans-serif',
              fontWeight: 600,
              fontSize: isMobile ? '24px' : '28px',
              lineHeight: '150%',
              letterSpacing: '0px',
            }}
          >
            User Opinion {isMobile ? <br /> : null} Video Submission
          </p>

          {/* Form: single column on all screens; fields then button for cleaner desktop layout */}
          <div className="flex flex-col gap-6 md:gap-8">
            <div className="flex flex-col gap-4 md:gap-5">
              {/* Row 1: Category Dropdown and Opinion */}
              <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '12px' }}>
                {/* Category Dropdown - custom for mobile-safe positioning and field-like styling */}
                <div className="relative" ref={categoryTriggerRef}>
                  <button
                    ref={categoryButtonRef}
                    type="button"
                    onClick={() => setDropdownOpen((o) => !o)}
                    className={`w-full text-center cursor-pointer transition-colors focus:outline-none focus:border-white/40 ${
                      errors.category
                        ? "bg-red-500/20 border-red-500"
                        : "bg-white/10 border-white/20"
                    } text-white placeholder:text-white/60`}
                    style={{
                      ...fieldStyle,
                      paddingRight: "calc(32px + 24px)",
                      textAlign: "center",
                    }}
                  >
                    <span
                      className={
                        !formData.category ? "text-white/60" : "text-white"
                      }
                    >
                      {formData.category || "Select Category"}
                    </span>
                  </button>
                  {/* Dropdown Arrow */}
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      right: "16px",
                      top: "50%",
                      transform: `translateY(-50%)${dropdownOpen ? " rotate(180deg)" : ""}`,
                    }}
                  >
                    <svg
                      width="12"
                      height="8"
                      viewBox="0 0 12 8"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M1 1L6 6L11 1"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  {/* Options panel - on mobile: portaled to body so position:fixed is viewport-relative; exactly beneath Select Category */}
                  {dropdownOpen && (!isMobile || dropdownMobileStyle) && (
                    <>
                      {isMobile && typeof document !== "undefined"
                        ? createPortal(
                            <div
                              ref={dropdownRef}
                              className="z-[9999] overflow-y-auto rounded-xl border border-white/20 bg-[#1a1a1a] shadow-lg"
                              style={
                                dropdownMobileStyle
                                  ? {
                                      position: "fixed",
                                      top: dropdownMobileStyle.top,
                                      left: dropdownMobileStyle.left,
                                      width: dropdownMobileStyle.width,
                                      maxHeight: "min(60vh, 320px)",
                                    }
                                  : undefined
                              }
                            >
                              {categories.map((cat) => (
                                <button
                                  key={cat}
                                  type="button"
                                  onClick={() => {
                                    setFormData((prev) => ({ ...prev, category: cat }));
                                    setErrors((prev) => ({ ...prev, category: undefined }));
                                    setDropdownOpen(false);
                                  }}
                                  className="w-full px-4 py-3 text-left text-white hover:bg-white/15 focus:bg-white/15 focus:outline-none transition-colors first:rounded-t-xl last:rounded-b-xl border-b border-white/10 last:border-b-0"
                                >
                                  {cat}
                                </button>
                              ))}
                            </div>,
                            document.body
                          )
                        : (
                            <div
                              ref={dropdownRef}
                              className="z-50 overflow-y-auto rounded-xl border border-white/20 bg-[#1a1a1a] shadow-lg absolute left-0 top-full mt-1 w-full max-h-[280px]"
                            >
                              {categories.map((cat) => (
                                <button
                                  key={cat}
                                  type="button"
                                  onClick={() => {
                                    setFormData((prev) => ({ ...prev, category: cat }));
                                    setErrors((prev) => ({ ...prev, category: undefined }));
                                    setDropdownOpen(false);
                                  }}
                                  className="w-full px-4 py-3 text-left text-white hover:bg-white/15 focus:bg-white/15 focus:outline-none transition-colors first:rounded-t-xl last:rounded-b-xl border-b border-white/10 last:border-b-0"
                                >
                                  {cat}
                                </button>
                              ))}
                            </div>
                          )}
                    </>
                  )}
                  {errors.category && (
                    <p className="text-red-400 text-sm mt-1">{errors.category}</p>
                  )}
                </div>

                {/* Opinion Input */}
                <div>
                  <input
                    type="text"
                    name="opinion"
                    value={formData.opinion}
                    onChange={handleChange}
                    placeholder="Write your opinion (optional)"
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
                  />
                </div>
              </div>

              {/* Row 2: URL and Username */}
              <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '12px' }}>
                {/* URL Input */}
                <div>
                  <input
                    type="text"
                    name="url"
                    value={formData.url}
                    onChange={handleChange}
                    placeholder="URL (optional)"
                    className={`w-full text-white text-center transition-colors ${errors.url
                        ? 'bg-red-500/20 border-red-500'
                        : 'bg-white/10 border-white/20'
                      } focus:outline-none focus:border-white/40 placeholder:text-white/60`}
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
                  />
                  {errors.url && (
                    <p className="text-red-400 text-sm mt-1">{errors.url}</p>
                  )}
                </div>

                {/* Username Input */}
                <div>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    placeholder="Write your username (optional)"
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
                  />
                </div>
              </div>

              {/* Row 3: Email/Social Account (Full Width) */}
              <div>
                <input
                  type="text"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Write down your email/social account"
                  className={`w-full rounded-lg px-4 py-3 text-white text-center transition-colors ${errors.email
                      ? 'bg-red-500/20 border-2 border-red-500'
                      : 'bg-white/10 border border-white/20'
                    } focus:outline-none focus:border-white/40 placeholder:text-white/60`}
                  style={{ // Added inline style to match others
                    height: '56px',
                    borderRadius: '12px',
                    paddingTop: '16px',
                    paddingRight: '32px',
                    paddingBottom: '16px',
                    paddingLeft: '32px',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                  }}
                />
                {errors.email && (
                  <p className="text-red-400 text-sm mt-1">{errors.email}</p>
                )}
              </div>
            </div>

            {/* Submit Button - below fields, centered and proportional on desktop */}
            <div className="flex justify-center pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="text-[#1a1a1a] font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto md:min-w-[200px] rounded-full bg-white px-10 py-4 md:py-3.5 text-base"
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
