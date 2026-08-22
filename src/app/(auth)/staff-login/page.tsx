// src\app\(auth)\staff-login\page.tsx

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Phone, KeyRound, UtensilsCrossed, Lock, Eye, EyeOff, ShieldCheck, Key } from "lucide-react";
import toast from "react-hot-toast";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import { getDeviceVisitorId } from "@/lib/fingerprint-client";
import { triggerWidgetSendOtp, triggerWidgetVerifyOtp } from "@/lib/msg91-widget-client";

type Method = "password" | "reset-password";
type Step = "mobile" | "otp" | "set-password";

export default function StaffLoginPage() {
  const router = useRouter();
  const [method, setMethod] = useState<Method>("password");
  const [step, setStep] = useState<Step>("mobile");
  const [isForgotPassword, setIsForgotPassword] = useState(false);

  // Form fields
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

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

  const handleSendResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!mobile.trim() || mobile.length !== 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    setIsLoading(true);
    try {
      const visitorId = await getDeviceVisitorId();
      const res = await fetch("/api/staff/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mobile: mobile.trim(),
          deviceVisitorId: visitorId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to send reset OTP. Please try again.");
      } else {
        // Trigger MSG91 Widget SMS delivery directly on the client
        await triggerWidgetSendOtp(mobile.trim());

        toast.success(data.message || "Reset OTP sent successfully.");
        setStep("otp");
      }
    } catch (err: any) {
      setError(err?.message || "Network error. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!otp.trim() || otp.length !== 6) {
      setError("Please enter a valid 6-digit OTP code.");
      return;
    }

    setIsLoading(true);
    try {
      // 1. Verify OTP with MSG91 Widget on client to get JWT access token
      let widgetToken: string;
      try {
        widgetToken = await triggerWidgetVerifyOtp(mobile.trim(), otp.trim());
      } catch (err: any) {
        setError(err?.message || "Verification failed. Please check your code.");
        setIsLoading(false);
        return;
      }

      // 2. Verify token with backend
      const res = await fetch("/api/staff/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: mobile.trim(), widgetToken }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Verification failed. Please try again.");
      } else {
        toast.success("OTP verified! Please set your new password below.");
        setStep("set-password");
      }
    } catch (err: any) {
      setError(err?.message || "Network error. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!mobile.trim() || mobile.length !== 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/staff/login-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: mobile.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed. Please check your credentials.");
      } else if (data.mustChangePassword) {
        toast.success("Login successful. Please set a new password.");
        setStep("set-password");
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

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!newPassword || !confirmPassword) {
      setError("Please fill out both password fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/staff/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword, confirmPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to set password.");
      } else {
        toast.success(isForgotPassword ? "New password set successfully!" : "Password saved successfully!");
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <div className="flex-grow flex items-center justify-center p-4 py-12">
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

          {/* Forgot Password Mode Banner */}
          {isForgotPassword && step !== "set-password" && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-2xl flex items-center justify-between text-xs font-semibold text-orange-700">
              <div className="flex items-center gap-2">
                <Key size={16} className="text-orange-500" />
                <span>Reset Password Mode</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(false);
                  setMethod("password");
                  setStep("mobile");
                  setError("");
                }}
                className="text-[11px] underline text-orange-600 hover:text-orange-800 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs font-medium text-red-600 leading-relaxed">
              {error}
            </div>
          )}

          {/* Password Login Flow */}
          {method === "password" && step === "mobile" && !isForgotPassword && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="pwd-mobile" className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                  Mobile Number
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-semibold select-none">
                    +91
                  </span>
                  <input
                    id="pwd-mobile"
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

              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(true);
                    setMethod("reset-password");
                    setStep("mobile");
                    setError("");
                  }}
                  className="text-xs font-semibold text-orange-500 hover:text-orange-600 transition-colors cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-4 pr-10 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading || mobile.length !== 10 || !password}
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-bold rounded-xl text-sm shadow-sm hover:shadow shadow-orange-500/10 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Lock size={16} />
                )}
                <span>Sign In</span>
              </button>
            </form>
          )}

          {/* Reset Password Flow - Step 1: Send Reset OTP */}
          {isForgotPassword && step === "mobile" && (
            <form onSubmit={handleSendResetOtp} className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="mobile" className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                  Registered Mobile Number
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
                <span>Send Reset OTP Code</span>
              </button>
            </form>
          )}

          {/* Reset Password Flow - Step 2: Code Verification */}
          {isForgotPassword && step === "otp" && (
            <form onSubmit={handleVerifyResetOtp} className="space-y-4">
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
                    className="text-xs font-semibold text-orange-500 hover:text-orange-600 transition-colors cursor-pointer"
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
                  maxLength={6}
                  placeholder="••••••"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-full py-3 border border-gray-200 rounded-xl text-lg font-bold font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || otp.length !== 6}
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-bold rounded-xl text-sm shadow-sm hover:shadow shadow-orange-500/10 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <KeyRound size={16} />
                )}
                <span>Verify OTP & Set Password</span>
              </button>
            </form>
          )}

          {/* Set New Password */}
          {step === "set-password" && (
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div className="text-center space-y-1 bg-orange-50/60 p-3 rounded-2xl border border-orange-100">
                <ShieldCheck size={24} className="text-orange-500 mx-auto" />
                <h3 className="font-bold text-gray-900 text-sm">
                  {isForgotPassword ? "Set Your New Password" : "Create Your Password"}
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  {isForgotPassword
                    ? "Enter your new strong password below to finish resetting your credentials."
                    : "Set a password for future logins. Must be 8–30 characters, including uppercase, lowercase, number, and special character."}
                </p>
              </div>

              <div className="space-y-1">
                <label htmlFor="new-password" className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                  New Password
                </label>
                <input
                  id="new-password"
                  type="password"
                  placeholder="8-30 char strong password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all"
                  required
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="confirm-password" className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                  Confirm New Password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !newPassword || !confirmPassword}
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-bold rounded-xl text-sm shadow-sm hover:shadow shadow-orange-500/10 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <ShieldCheck size={16} />
                )}
                <span>{isForgotPassword ? "Set New Password & Login" : "Save Password & Continue"}</span>
              </button>

              {!isForgotPassword && (
                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  className="w-full py-2 text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors text-center block cursor-pointer"
                >
                  Skip for now
                </button>
              )}
            </form>
          )}

        </div>
      </div>
      <Footer />
    </div>
  );
}
