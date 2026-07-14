"use client";

import { useRouter } from "next/navigation";
import RegisterForm from "./RegisterForm";
import LoginForm from "./LoginForm";
import VerifyForm from "./VerifyForm";

interface Props {
  activeTab: "register" | "login" | "verify";
  draftId?: string;
}

export default function AuthTabs({ activeTab, draftId }: Props) {
  const router = useRouter();

  const handleSuccess = () => {
    // Force a full reload to menu so that cookie state is reread server-side
    window.location.href = "/menu";
  };

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-12 flex justify-center">
      <div className="w-full max-w-md">

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/60 overflow-hidden border border-gray-100">
          {/* Header Title */}
          <div className="px-5 md:px-6 pt-5 pb-3.5 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-lg font-bold text-gray-900 capitalize text-center">
              {activeTab === "register"
                ? "Register Account"
                : activeTab === "login"
                ? "Sign In"
                : "Verify Mobile"}
            </h2>
            <p className="text-xs text-gray-400 text-center mt-1">
              {activeTab === "register"
                ? "Create an account to start ordering thalis"
                : activeTab === "login"
                ? "Enter your credentials to access your account"
                : "Enter OTP code sent to your mobile"}
            </p>
          </div>

          {/* Form Content */}
          <div className="p-4 sm:p-6">
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

        <p className="text-center text-xs text-gray-400 mt-4 md:mt-6">
          By continuing you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
}
