// src\components\customer\AuthTabs.tsx

"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import RegisterForm from "./RegisterForm";
import LoginForm from "./LoginForm";
import VerifyForm from "./VerifyForm";

interface Props {
  activeTab: "register" | "login" | "verify";
  draftId?: string;
}

const TAB_CONFIG = {
  register: {
    title: "Create Your Account",
    subtitle: "Join ViTa Cuisine and start ordering fresh meals today",
    emoji: "🍽️",
  },
  login: {
    title: "Welcome Back",
    subtitle: "Sign in to your ViTa Cuisine account",
    emoji: "👋",
  },
  verify: {
    title: "Verify & Set PIN",
    subtitle: "Complete your account setup in one go",
    emoji: "📱",
  },
};

export default function AuthTabs({ activeTab, draftId }: Props) {
  const router = useRouter();

  const handleSuccess = () => {
    // Force a full reload so cookie state is re-read server-side
    window.location.href = "/menu";
  };

  const cfg = TAB_CONFIG[activeTab];

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">

        {/* Brand header above card */}
        <div className="text-center mb-8">
          <a href="/" className="inline-block mb-4">
            <Image
              src="/vita-Logo.png"
              alt="ViTa Cuisine"
              width={72}
              height={72}
              className="object-contain mx-auto"
              priority
            />
          </a>
          <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-widest mt-1">
            Think Food, Think Us
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-2xl shadow-[#0F1E3D]/10 overflow-hidden border border-[#1B2D5A]/8">

          {/* Card Header — dark navy */}
          <div className="bg-[#0F1E3D] px-6 py-5 text-center relative overflow-hidden">
            {/* Subtle gold glow */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#C9A84C18_0%,_transparent_70%)] pointer-events-none" />
            <span className="text-2xl block mb-1 relative z-10">{cfg.emoji}</span>
            <h2 className="text-lg font-extrabold text-white relative z-10">{cfg.title}</h2>
            <p className="text-xs text-gray-400 mt-1 relative z-10">{cfg.subtitle}</p>
          </div>

          {/* Tab Pills */}
          <div className="flex border-b border-gray-100 bg-gray-50/60">
            {(["register", "login", "verify"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => router.push(`/${tab}`)}
                className={`flex-1 py-2.5 text-xs font-bold transition-all duration-200 capitalize ${
                  activeTab === tab
                    ? "text-[#1B2D5A] border-b-2 border-[#C9A84C] bg-white"
                    : "text-gray-400 hover:text-[#1B2D5A] hover:bg-white/60"
                }`}
              >
                {tab === "verify" ? "Verify" : tab}
              </button>
            ))}
          </div>

          {/* Form Content */}
          <div className="p-5 sm:p-6">
            {activeTab === "register" && (
              <RegisterForm
                onSuccess={handleSuccess}
                onSwitchToLogin={() => router.push("/login")}
              />
            )}

            {activeTab === "login" && (
              <LoginForm
                onSuccess={handleSuccess}
                onSwitchToRegister={() => router.push("/register")}
                onSwitchToVerify={() => router.push("/verify")}
              />
            )}

            {activeTab === "verify" && (
              <VerifyForm
                initialDraftId={draftId}
                onSuccess={handleSuccess}
                onSwitchToRegister={() => router.push("/register")}
              />
            )}
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-400 mt-5">
          By continuing you agree to our{" "}
          <span className="text-[#C9A84C] font-semibold">Terms of Service</span>
        </p>

        {/* Back to home link */}
        <p className="text-center mt-3">
          <a href="/" className="text-xs text-[#1B2D5A] font-semibold hover:text-[#C9A84C] transition-colors">
            ← Back to ViTa Cuisine Home
          </a>
        </p>
      </div>
    </div>
  );
}
