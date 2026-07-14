"use client";

import { useRouter } from "next/navigation";
import RegisterForm from "./RegisterForm";
import LoginForm from "./LoginForm";
import VerifyForm from "./VerifyForm";

interface Props {
  activeTab: "register" | "login" | "verify";
  draftId?: string;
}

const TABS = [
  { key: "register", label: "Register", path: "/register" },
  { key: "login", label: "Login", path: "/login" },
  { key: "verify", label: "Verify", path: "/verify" },
] as const;

export default function AuthTabs({ activeTab, draftId }: Props) {
  const router = useRouter();

  const handleSuccess = () => {
    // Force a full reload to menu so that cookie state is reread server-side
    window.location.href = "/menu";
  };

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
                onClick={() => router.push(tab.path)}
                className={`flex-1 py-3.5 text-sm font-semibold transition-all duration-200 cursor-pointer ${
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

        <p className="text-center text-xs text-gray-400 mt-6">
          By registering you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
}
