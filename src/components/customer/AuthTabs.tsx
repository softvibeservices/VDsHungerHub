"use client";

import { useState } from "react";
import RegisterForm from "./RegisterForm";
import LoginForm from "./LoginForm";
import VerifyForm from "./VerifyForm";

interface Props {
  defaultTab?: "register" | "login" | "verify";
  draftId?: string;
}

const TABS = [
  { key: "register", label: "Register" },
  { key: "login", label: "Login" },
  { key: "verify", label: "Verify" },
] as const;

type Tab = (typeof TABS)[number]["key"];

export default function AuthTabs({ defaultTab = "register", draftId }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-500/30 mb-4">
            <span className="text-white text-2xl">🍱</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            VD&apos;s Hunger Hub
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Fresh home-style thalis, delivered daily
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/60 overflow-hidden border border-gray-100">
          {/* Tabs */}
          <div className="flex border-b border-gray-100 bg-gray-50/50">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                id={`auth-tab-${tab.key}`}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-3.5 text-sm font-semibold transition-all duration-200 ${
                  activeTab === tab.key
                    ? "text-orange-600 border-b-2 border-orange-500 bg-white -mb-px"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-6">
            {activeTab === "register" && (
              <RegisterForm
                onSuccess={() => {
                  // After login, router will redirect to /menu which re-renders
                  window.location.reload();
                }}
                onSwitchToLogin={() => setActiveTab("login")}
              />
            )}

            {activeTab === "login" && (
              <LoginForm
                onSuccess={() => window.location.reload()}
                onSwitchToRegister={() => setActiveTab("register")}
                onSwitchToVerify={() => setActiveTab("verify")}
              />
            )}

            {activeTab === "verify" && (
              <VerifyForm
                initialDraftId={draftId}
                onSuccess={() => window.location.reload()}
                onSwitchToRegister={() => setActiveTab("register")}
              />
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          By registering you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
}
