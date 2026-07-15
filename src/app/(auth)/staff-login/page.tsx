"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Phone, KeyRound, UtensilsCrossed } from "lucide-react";
import toast from "react-hot-toast";

type Step = "mobile" | "otp";

export default function StaffLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("mobile");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Check if staff session already exists
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("/api/staff/me");
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            router.push("/dashboard");
          }
        }
      } catch {
        // ignore
      }
    }
    checkSession();
  }, [router]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!mobile.trim() || mobile.length !== 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/staff/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: mobile.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to send OTP. Please try again.");
      } else {
        toast.success(data.message || "OTP sent successfully.");
        setStep("otp");
      }
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!otp.trim() || otp.length !== 4) {
      setError("Please enter a valid 4-digit OTP code.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/staff/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: mobile.trim(), otpCode: otp.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Verification failed. Please try again.");
      } else {
        toast.success("Logged in successfully!");
        router.push(data.redirectTo || "/dashboard");
        router.refresh();
      }
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl border border-gray-200 p-8 shadow-sm space-y-6">
        
        {/* Brand & Logo */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-md mx-auto">
            <UtensilsCrossed className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-gray-900 leading-tight">
              TiffinOS Portal
            </h2>
            <p className="text-xs text-gray-400 font-medium">
              Staff & Admin Secure Access
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs font-medium text-red-600">
            {error}
          </div>
        )}

        {step === "mobile" && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="mobile" className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                Mobile Number
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-semibold select-none">
                  +91
                </span>
                <input
                  id="mobile"
                  type="tel"
                  maxLength={10}
                  placeholder="Enter 10-digit mobile"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || mobile.length !== 10}
              className="w-full py-3 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-bold rounded-xl text-sm shadow-sm hover:shadow shadow-orange-500/10 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Phone size={16} />
              )}
              <span>Send OTP Code</span>
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label htmlFor="otp" className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                  Verification Code
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setStep("mobile");
                    setOtp("");
                    setError("");
                  }}
                  className="text-xs font-semibold text-orange-500 hover:text-orange-600 transition-colors"
                >
                  Change number
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Enter the 6-digit OTP code sent to <span className="font-semibold text-gray-700">+91 {mobile}</span>
              </p>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="w-full py-3 border border-gray-200 rounded-xl text-lg font-bold font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || otp.length !== 4}
              className="w-full py-3 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-bold rounded-xl text-sm shadow-sm hover:shadow shadow-orange-500/10 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <KeyRound size={16} />
              )}
              <span>Verify & Login</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
