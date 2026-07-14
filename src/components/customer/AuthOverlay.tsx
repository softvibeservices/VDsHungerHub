"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import RegisterForm from "./RegisterForm";
import LoginForm from "./LoginForm";
import VerifyForm from "./VerifyForm";

// ── Types ──────────────────────────────────────────────────────────────────────

export type AuthMode = "login" | "register" | "verify";

interface Props {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onSuccess: () => void;
  onClose: () => void;
  title?: string;
}

// ── AuthOverlay ────────────────────────────────────────────────────────────────
//
// Renders as:
//   - Desktop (≥768px): centered modal with backdrop blur
//   - Mobile (<768px): bottom sheet that slides up from the bottom
//
// Traps focus and closes on backdrop click or Escape key.
// Does NOT navigate away from the current page — the menu stays visible behind it.

export default function AuthOverlay({
  mode,
  onModeChange,
  onSuccess,
  onClose,
  title,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Prevent body scroll while overlay is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const tabLabels: { key: AuthMode; label: string }[] = [
    { key: "login", label: "Login" },
    { key: "register", label: "Register" },
    { key: "verify", label: "Resume" },
  ];

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Authentication"
    >
      {/* Blurred backdrop — click to close */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel — bottom sheet on mobile, centered modal on desktop */}
      <div
        ref={panelRef}
        className="
          relative z-10 w-full bg-white shadow-2xl
          rounded-t-3xl md:rounded-3xl
          max-h-[92dvh] md:max-h-[90vh] overflow-y-auto
          md:max-w-md md:m-4
          animate-slide-up md:animate-scale-in
        "
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {/* Handle bar (mobile only) */}
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🍱</span>
            <div>
              <h2 className="font-bold text-gray-900 text-base leading-tight">
                {title ?? "VD's Hunger Hub"}
              </h2>
              <p className="text-xs text-gray-400">Sign in to place your order</p>
            </div>
          </div>
          <button
            id="auth-overlay-close"
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 bg-gray-50/60">
          {tabLabels.map((tab) => (
            <button
              key={tab.key}
              id={`auth-tab-${tab.key}`}
              onClick={() => onModeChange(tab.key)}
              className={`flex-1 py-3 text-sm font-semibold transition-all duration-200 ${
                mode === tab.key
                  ? "text-orange-600 border-b-2 border-orange-500 bg-white -mb-px"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5 pb-8">
          {mode === "login" && (
            <LoginForm
              onSuccess={onSuccess}
              onSwitchToRegister={() => onModeChange("register")}
              onSwitchToVerify={() => onModeChange("verify")}
            />
          )}
          {mode === "register" && (
            <RegisterForm
              onSuccess={onSuccess}
              onSwitchToLogin={() => onModeChange("login")}
            />
          )}
          {mode === "verify" && (
            <VerifyForm
              onSuccess={onSuccess}
              onSwitchToRegister={() => onModeChange("register")}
            />
          )}
        </div>
      </div>

      {/* Slide-up animation (injected into global styles via tailwind arbitrary) */}
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-slide-up { animation: slideUp 0.28s cubic-bezier(0.32, 0.72, 0, 1) forwards; }
        @media (min-width: 768px) {
          .animate-slide-up { animation: none; }
          .md\\:animate-scale-in { animation: scaleIn 0.2s ease-out forwards; }
        }
      `}</style>
    </div>
  );
}
