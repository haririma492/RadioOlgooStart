"use client";

import React, { useState } from "react";

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

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
          className="mx-auto"
          style={{
            borderRadius: '24px',
            background: '#FFFFFF29',
            backdropFilter: 'blur(36.974998474121094px)',
            padding: isMobile ? '32px 20px' : '52px 48px',
            minHeight: '560px',
            width: '100%',
            maxWidth: '100%',
          }}
        >
          {/* Form Title */}
          <p
            className="text-white mb-10 text-center"
            style={{
              fontFamily: 'Urbanist, sans-serif',
              fontWeight: 600,
              fontSize: '32px',
              lineHeight: '150%',
              letterSpacing: '0px',
            }}
          >
            User Opinion {isMobile ? <br /> : null} Video Submission
          </p>

          {/* Form Fields - 60/40 split: All fields on left, button on right */}
          <div className="grid grid-cols-1 md:grid-cols-[60%_40%] gap-6 md:gap-10 items-center">
            {/* Left Column: All Fields - 60% */}
            <div style={{ gap: '18px', display: 'flex', flexDirection: 'column', paddingRight: isMobile ? '0' : '32px' }}>
              {/* Row 1: Category Dropdown and Opinion */}
              <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '12px' }}>
                {/* Category Dropdown */}
                <div className="relative">
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className={`w-full text-white text-center appearance-none cursor-pointer transition-colors ${errors.category
                        ? 'bg-red-500/20 border-red-500'
                        : 'bg-white/10 border-white/20'
                      } focus:outline-none focus:border-white/40`}
                    style={{
                      height: '56px',
                      borderRadius: '12px',
                      paddingTop: '16px',
                      paddingRight: 'calc(32px + 24px)', // Space for icon
                      paddingBottom: '16px',
                      paddingLeft: '32px',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      opacity: 1,
                      textAlign: 'center',
                    }}
                  >
                    <option value="" className="bg-[#1a1a1a] text-white">
                      Select Category
                    </option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat} className="bg-[#1a1a1a] text-white">
                        {cat}
                      </option>
                    ))}
                  </select>
                  {/* Dropdown Arrow - Fixed position */}
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      right: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
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

            {/* Right Column: Submit Button - 40% - Centered vertically and horizontally */}
            <div className="flex items-center justify-center" style={{ paddingLeft: isMobile ? '0' : '32px' }}>
              <button
                type="submit"
                disabled={isSubmitting}
                className="text-[#1a1a1a] font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  height: '64px',
                  borderRadius: '46px',
                  backgroundColor: '#FFFFFF',
                  paddingTop: '18px',
                  paddingRight: '48px',
                  paddingBottom: '18px',
                  paddingLeft: '48px',
                  opacity: 1,
                  width: '100%',
                  maxWidth: isMobile ? '100%' : '280px',
                }}
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
