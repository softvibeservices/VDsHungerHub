"use client";

import { useState, useEffect } from "react";
import { Loader2, Phone, KeyRound, Eye, EyeOff } from "lucide-react";
import { getDeviceVisitorId } from "@/lib/fingerprint-client";


interface Props {
  onSuccess: () => void;
  onSwitchToRegister: () => void;
  onSwitchToVerify: () => void;
}

type LoginMode = "pin" | "otp";


export default function LoginForm({ onSuccess, onSwitchToRegister, onSwitchToVerify }: Props) {
  const [mode, setMode] = useState<LoginMode>("pin");
  const [mobile, setMobile] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [preAuthToken, setPreAuthToken] = useState("");

  // Forgot PIN
  const [forgotPin, setForgotPin] = useState(false);
  const [fpOtpSent, setFpOtpSent] = useState(false);
  const [fpOtp, setFpOtp] = useState("");
  const [fpPreAuth, setFpPreAuth] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [fpStep, setFpStep] = useState<"mobile" | "otp" | "pin">("mobile");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (otpCooldown <= 0) return;
    const t = setTimeout(() => setOtpCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCooldown]);

  // ── PIN login ─────────────────────────────────────────────────────────────
  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const visitorId = await getDeviceVisitorId();
      const res = await fetch("/api/customer/login-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, pin, deviceVisitorId: visitorId }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.forceOtp) {
          setMode("otp");
          setError("Too many PIN failures. Please log in via OTP.");
          return;
        }
        setError(data.error ?? "Login failed");
        return;
      }

      onSuccess();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── OTP login: send ───────────────────────────────────────────────────────
  const handleSendLoginOtp = async () => {
    setError("");
    setLoading(true);

    try {
      const visitorId = await getDeviceVisitorId();
      const res = await fetch("/api/customer/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, deviceVisitorId: visitorId, purpose: "LOGIN" }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to send OTP");
        return;
      }

      setOtpSent(true);
      setOtpCooldown(60);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  // ── OTP login: verify → session ──────────────────────────────────────────
  const handleVerifyLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1. Verify OTP → get preAuthToken
      const verifyRes = await fetch("/api/customer/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, otp, purpose: "LOGIN" }),
      });
      const verifyData = await verifyRes.json();

      if (!verifyRes.ok) {
        setError(verifyData.error ?? "OTP verification failed");
        return;
      }

      // 2. Exchange preAuthToken for session
      const visitorId = await getDeviceVisitorId();
      const sessionRes = await fetch("/api/customer/login-otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preAuthToken: verifyData.preAuthToken, deviceVisitorId: visitorId }),
      });
      const sessionData = await sessionRes.json();

      if (!sessionRes.ok) {
        setError(sessionData.error ?? "Session creation failed");
        return;
      }

      onSuccess();
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot PIN: send OTP ──────────────────────────────────────────────────
  const handleForgotPinSendOtp = async () => {
    setError("");
    setLoading(true);

    try {
      const visitorId = await getDeviceVisitorId();
      const res = await fetch("/api/customer/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, deviceVisitorId: visitorId, purpose: "FORGOT_PIN" }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to send OTP");
        return;
      }

      setFpOtpSent(true);
      setFpStep("otp");
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPinVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/customer/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, otp: fpOtp, purpose: "FORGOT_PIN" }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "OTP verification failed");
        return;
      }

      setFpPreAuth(data.preAuthToken);
      setFpStep("pin");
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPinReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPin !== confirmNewPin) {
      setError("PINs do not match");
      return;
    }

    setLoading(true);

    try {
      const visitorId = await getDeviceVisitorId();
      const res = await fetch("/api/customer/forgot-pin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preAuthToken: fpPreAuth,
          pin: newPin,
          confirmPin: confirmNewPin,
          deviceVisitorId: visitorId,
          mobile,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to reset PIN");
        return;
      }

      onSuccess();
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot PIN flow ───────────────────────────────────────────────────────
  if (forgotPin) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <button onClick={() => { setForgotPin(false); setFpStep("mobile"); setError(""); }} className="text-gray-400 hover:text-gray-600 text-xs">← Back</button>
          <h3 className="font-bold text-gray-900 text-sm">Reset PIN</h3>
        </div>

        {error && <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{error}</div>}

        {fpStep === "mobile" && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">Enter your registered mobile number to receive a reset OTP.</p>
            <div className="flex gap-2">
              <span className="flex items-center px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500">+91</span>
              <input id="fp-mobile" type="tel" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} maxLength={10} placeholder="10-digit number"
                className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all" />
            </div>
            <button id="fp-send-otp" type="button" onClick={handleForgotPinSendOtp} disabled={loading || mobile.length !== 10}
              className="w-full py-2.5 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {loading && <Loader2 size={14} className="animate-spin" />} Send OTP
            </button>
          </div>
        )}

        {fpStep === "otp" && (
          <form onSubmit={handleForgotPinVerifyOtp} className="space-y-3">
            <p className="text-xs text-gray-500">Enter the OTP sent to +91 {mobile}</p>
            <input id="fp-otp" type="text" inputMode="numeric" value={fpOtp} onChange={(e) => setFpOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6} placeholder="••••••"
              className="w-full px-3.5 py-3 border border-gray-200 rounded-xl text-lg font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all" />
            <button id="fp-verify-otp" type="submit" disabled={loading || fpOtp.length !== 6}
              className="w-full py-2.5 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {loading && <Loader2 size={14} className="animate-spin" />} Verify OTP
            </button>
          </form>
        )}

        {fpStep === "pin" && (
          <form onSubmit={handleForgotPinReset} className="space-y-3">
            <p className="text-xs text-gray-500">Set your new 6-digit PIN</p>
            <input id="fp-new-pin" type="password" inputMode="numeric" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6} placeholder="New PIN (6 digits)"
              className="w-full px-3.5 py-3 border border-gray-200 rounded-xl text-lg font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all" />
            <input id="fp-confirm-pin" type="password" inputMode="numeric" value={confirmNewPin} onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6} placeholder="Confirm PIN"
              className="w-full px-3.5 py-3 border border-gray-200 rounded-xl text-lg font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all" />
            <button id="fp-reset" type="submit" disabled={loading || newPin.length !== 6 || confirmNewPin.length !== 6}
              className="w-full py-2.5 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {loading && <Loader2 size={14} className="animate-spin" />} Set New PIN
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Mode switch */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-5">
        {(["pin", "otp"] as const).map((m) => (
          <button key={m} onClick={() => { setMode(m); setError(""); setOtpSent(false); setOtp(""); }} id={`login-mode-${m}`}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${mode === m ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {m === "pin" ? "PIN Login" : "OTP Login"}
          </button>
        ))}
      </div>

      {error && <div className="mb-3 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{error}</div>}

      {/* Mobile field (shared) */}
      <div className="mb-3">
        <label className="block text-xs font-semibold text-gray-700 mb-1">Mobile Number</label>
        <div className="flex gap-2">
          <span className="flex items-center px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500">+91</span>
          <input id="login-mobile" type="tel" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
            maxLength={10} placeholder="10-digit number"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all" />
        </div>
      </div>

      {/* PIN mode */}
      {mode === "pin" && (
        <form onSubmit={handlePinLogin} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">PIN</label>
            <div className="relative">
              <input id="login-pin" type={showPin ? "text" : "password"} inputMode="numeric"
                value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6} placeholder="••••••"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-lg font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all pr-10" />
              <button type="button" onClick={() => setShowPin((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button id="login-pin-submit" type="submit" disabled={loading || mobile.length !== 10 || pin.length !== 6}
            className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl text-sm hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-md shadow-orange-500/20 cursor-pointer">
            {loading && <Loader2 size={16} className="animate-spin" />} Login
          </button>

          <div className="flex items-center justify-between text-xs">
            <button type="button" onClick={() => { setForgotPin(true); setError(""); }} className="text-orange-600 hover:underline font-medium">
              Forgot PIN?
            </button>
            <button type="button" onClick={onSwitchToRegister} className="text-gray-500 hover:text-gray-700">
              Not registered? <span className="text-orange-600 font-semibold">Sign up</span>
            </button>
          </div>
        </form>
      )}

      {/* OTP mode */}
      {mode === "otp" && (
        <form onSubmit={handleVerifyLoginOtp} className="space-y-3">
          <div className="flex gap-2">
            <button type="button" id="login-otp-send" onClick={handleSendLoginOtp}
              disabled={loading || mobile.length !== 10 || otpCooldown > 0}
              className="w-full py-2.5 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 cursor-pointer">
              {loading && !otpSent && <Loader2 size={14} className="animate-spin" />}
              {otpCooldown > 0 ? `Resend in ${otpCooldown}s` : otpSent ? "Resend OTP" : "Send OTP"}
            </button>
          </div>

          {otpSent && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Enter OTP</label>
                <input id="login-otp-input" type="text" inputMode="numeric" value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6} placeholder="••••••"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-lg font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all" />
              </div>
              <button id="login-otp-verify" type="submit" disabled={loading || otp.length !== 6}
                className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl text-sm hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-md shadow-orange-500/20 cursor-pointer">
                {loading && <Loader2 size={16} className="animate-spin" />} Verify & Login
              </button>
            </>
          )}

          <p className="text-center text-xs text-gray-500">
            Not registered?{" "}
            <button type="button" onClick={onSwitchToRegister} className="text-orange-600 font-semibold hover:underline cursor-pointer">Sign up</button>
          </p>
        </form>
      )}
    </div>
  );
}
