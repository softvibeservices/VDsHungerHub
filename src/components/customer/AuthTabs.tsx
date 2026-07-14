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
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-12 flex justify-center">
      <div className="w-full max-w-md">

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
