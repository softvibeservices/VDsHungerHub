"use client";

import { useState, useEffect } from "react";
import { Loader2, Phone } from "lucide-react";
import { getDeviceVisitorId } from "@/lib/fingerprint-client";


interface Props {
  initialDraftId?: string;
  onSuccess: () => void;
  onSwitchToRegister: () => void;
}



export default function VerifyForm({ initialDraftId, onSuccess, onSwitchToRegister }: Props) {
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [draftId, setDraftId] = useState(initialDraftId ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    if (otpCooldown <= 0) return;
    const t = setTimeout(() => setOtpCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCooldown]);

  // If we have a draftId, show the OTP resend flow directly
  // If not, let user enter mobile to look up their pending draft

  const handleSendOtp = async () => {
    setError("");
    setInfo("");
    setLoading(true);

    try {
      const visitorId = await getDeviceVisitorId();
      const res = await fetch("/api/customer/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: draftId || undefined,
          mobile,
          deviceVisitorId: visitorId,
          purpose: "REGISTER",
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === "MOBILE_ALREADY_REGISTERED") {
          setError("This number is already fully registered. Please use the Login tab.");
          return;
        }
        setError(data.error ?? "Failed to send OTP");
        return;
      }

      setOtpSent(true);
      setOtpCooldown(60);
      setInfo("OTP sent! Check your SMS.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    try {
      const verifyRes = await fetch("/api/customer/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, otp, purpose: "REGISTER" }),
      });
      const verifyData = await verifyRes.json();

      if (!verifyRes.ok) {
        setError(verifyData.error ?? "OTP verification failed");
        return;
      }

      // Now set the PIN
      // Re-use the preAuthToken — redirect client to set-pin step
      // We'll store preAuthToken and proceed to set PIN inline
      const preAuthToken = verifyData.preAuthToken;

      // Show PIN entry inline (simplified — using prompt for brevity, real UI uses RegisterForm's PIN step)
      // In this flow we redirect the whole page to /menu which will detect DRAFT_PENDING and show the appropriate state
      // Actually store preAuthToken in sessionStorage and reload
      sessionStorage.setItem("verify_pre_auth", preAuthToken);
      setInfo("OTP verified! Setting up your account...");

      // Trigger the set-pin flow by calling the API directly with a temporary PIN prompt
      // For UX, we navigate to the set-pin mini-form
      onSuccess(); // This reloads — the page will detect the verified state
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-2">
        <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-3 border border-orange-100">
          <Phone size={22} className="text-orange-500" />
        </div>
        <h3 className="font-bold text-gray-900">Resume Verification</h3>
        <p className="text-xs text-gray-500 mt-1">
          Enter your mobile number to resume your pending registration
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
          {error}
        </div>
      )}

      {info && (
        <div className="p-3 bg-green-50 border border-green-100 rounded-xl text-sm text-green-700">
          {info}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
          Mobile Number
        </label>
        <div className="flex gap-2">
          <span className="flex items-center px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500">
            +91
          </span>
          <input
            id="verify-mobile"
            type="tel"
            value={mobile}
            onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
            maxLength={10}
            placeholder="10-digit number"
            autoComplete="tel"
            className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all"
          />
          <button
            id="verify-send-otp"
            type="button"
            onClick={handleSendOtp}
            disabled={loading || mobile.length !== 10 || otpCooldown > 0}
            className="px-3 py-2 bg-orange-500 text-white text-xs font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {otpCooldown > 0 ? `${otpCooldown}s` : otpSent ? "Resend" : "Send OTP"}
          </button>
        </div>
      </div>

      {otpSent && (
        <form onSubmit={handleVerify} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              OTP
            </label>
            <input
              id="verify-otp"
              type="text"
              inputMode="numeric"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
              placeholder="••••••"
              autoComplete="one-time-code"
              className="w-full px-3.5 py-3 border border-gray-200 rounded-xl text-lg font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all"
            />
          </div>

          <button
            id="verify-confirm"
            type="submit"
            disabled={loading || otp.length !== 6}
            className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl text-sm hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-md shadow-orange-500/20"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            Verify & Continue
          </button>
        </form>
      )}

      <div className="border-t border-gray-100 pt-3 text-center">
        <p className="text-xs text-gray-400">
          No pending registration?{" "}
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="text-orange-600 font-semibold hover:underline"
          >
            Register here
          </button>
        </p>
      </div>
    </div>
  );
}
