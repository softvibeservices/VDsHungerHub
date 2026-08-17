// src\components\customer\VerifyForm.tsx

"use client";

import { useState, useEffect } from "react";
import { Loader2, Phone, KeyRound, CheckCircle, Eye, EyeOff, RefreshCw } from "lucide-react";
import { getDeviceVisitorId } from "@/lib/fingerprint-client";
import toast from "react-hot-toast";

type VerifyStep = "MOBILE_INPUT" | "VERIFY_AND_PIN";

interface Props {
  initialDraftId?: string;
  onSuccess: () => void;
  onSwitchToRegister: () => void;
}

export default function VerifyForm({ initialDraftId, onSuccess, onSwitchToRegister }: Props) {
  const [step, setStep] = useState<VerifyStep>("MOBILE_INPUT");
  const [mode, setMode] = useState<"REGISTER" | "FORGOT_PIN">("REGISTER");

  const [mobile, setMobile] = useState("");
  const [draftId] = useState(initialDraftId ?? "");

  const [otp, setOtp] = useState("");
  const [otpCooldown, setOtpCooldown] = useState(0);

  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Countdown timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const t = setTimeout(() => setOtpCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCooldown]);

  // ── Step indicators (2 steps) ──────────────────────────────────────────────
  const steps = ["Enter Mobile", "Verify & Set PIN"];
  const stepIdx = step === "MOBILE_INPUT" ? 0 : 1;

  // ── Step 1: Send OTP ───────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    setError("");
    setLoading(true);

    const toastId = toast.loading("Sending OTP to your mobile…");

    try {
      const visitorId = await getDeviceVisitorId();
      const purpose = mode === "FORGOT_PIN" ? "FORGOT_PIN" : "REGISTER";

      const res = await fetch("/api/customer/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: draftId || undefined,
          mobile,
          deviceVisitorId: visitorId,
          purpose,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.dismiss(toastId);

        // Mobile already registered
        if (data.error === "MOBILE_ALREADY_REGISTERED") {
          if (data.code === "VERIFIED_NO_PIN") {
            setMode("FORGOT_PIN");

            const retryRes = await fetch("/api/customer/send-otp", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ mobile, deviceVisitorId: visitorId, purpose: "FORGOT_PIN" }),
            });
            const retryData = await retryRes.json();

            if (!retryRes.ok) {
              if (retryData.waitSeconds) setOtpCooldown(retryData.waitSeconds);
              const msg = retryData.error ?? "Could not send OTP. Please try again.";
              setError(msg);
              toast.error(msg, { duration: 4000 });
              return;
            }

            toast.success("OTP sent! Enter OTP and set your PIN below.", { duration: 4000 });
            setOtpCooldown(60);
            setStep("VERIFY_AND_PIN");
            return;
          }

          const msg = "This number is already registered. Please use the Login tab to sign in.";
          setError(msg);
          toast.error(msg, { duration: 5000 });
          return;
        }

        // No pending registration
        if (
          res.status === 404 ||
          (data.error ?? "").toLowerCase().includes("no pending") ||
          (data.error ?? "").toLowerCase().includes("draftid")
        ) {
          const msg = "No pending registration found for this number. Please sign up first.";
          setError(msg);
          toast.error("No pending registration found — please sign up first.", { duration: 5000 });
          return;
        }

        // Rate limit
        if (res.status === 429) {
          if (data.waitSeconds) setOtpCooldown(data.waitSeconds);
          const msg = data.error ?? "Too many requests. Please wait a moment.";
          setError(msg);
          toast.error(msg, { duration: 5000 });
          return;
        }

        const msg = data.error ?? "Could not send OTP. Please try again.";
        setError(msg);
        toast.error(msg, { duration: 4000 });
        return;
      }

      toast.success("OTP sent! Enter OTP and set your PIN below.", { id: toastId, duration: 3000 });
      setOtpCooldown(60);
      setStep("VERIFY_AND_PIN");
    } catch {
      toast.error("Connection error. Please check your internet and try again.", { id: toastId });
      setError("Connection error. Please check your internet and try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Combined OTP Verification & PIN Setup ─────────────────────────
  const handleCombinedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (otp.length !== 6) {
      toast.error("Please enter the 6-digit OTP.");
      setError("Please enter the 6-digit OTP.");
      return;
    }

    if (pin.length !== 6) {
      toast.error("Please enter a 6-digit PIN.");
      setError("Please enter a 6-digit PIN.");
      return;
    }

    if (pin !== confirmPin) {
      toast.error("PINs don't match — please re-enter.");
      setError("PINs do not match. Please re-enter.");
      return;
    }

    const simplePins = [
      "000000", "111111", "222222", "333333", "444444", "555555", "666666", "777777", "888888", "999999",
      "123456", "654321"
    ];
    if (simplePins.includes(pin)) {
      toast.error("PIN too simple — choose something harder to guess.");
      setError("This PIN is too simple. Please choose a less obvious 6-digit number.");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Verifying & completing setup…");

    try {
      const visitorId = await getDeviceVisitorId();
      const purpose = mode === "FORGOT_PIN" ? "FORGOT_PIN" : "REGISTER";

      // 1. Verify OTP first
      const verifyRes = await fetch("/api/customer/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, otp, purpose }),
      });

      const verifyData = await verifyRes.json();

      if (!verifyRes.ok) {
        toast.dismiss(toastId);
        const msg =
          verifyRes.status === 404
            ? "OTP has expired. Please click Resend OTP."
            : verifyData.error ?? "Incorrect OTP. Please check and try again.";
        setError(msg);
        toast.error(msg, { duration: 4000 });
        return;
      }

      const preAuthToken = verifyData.preAuthToken;

      // 2. Immediately set PIN (atomic chain)
      const pinRes = await fetch("/api/customer/set-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preAuthToken,
          pin,
          confirmPin,
          deviceVisitorId: visitorId,
        }),
      });

      const pinData = await pinRes.json();

      if (!pinRes.ok) {
        toast.dismiss(toastId);
        const msg = pinData.error ?? "Could not create PIN. Please try again.";
        setError(msg);
        toast.error(msg, { duration: 4000 });
        return;
      }

      toast.success("Account ready! Welcome to ViTa Cuisine 🎉", {
        id: toastId,
        duration: 2500,
      });
      onSuccess();
    } catch {
      toast.error("Connection error. Please try again.", { id: toastId });
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all bg-white text-gray-800 placeholder-gray-400";

  return (
    <div className="space-y-4">
      {/* ── Step Indicator ─────────────────────────────────────────────────── */}
      <div className="flex items-center mb-5">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center flex-1">
            <div
              className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                i < stepIdx
                  ? "bg-green-500 text-white"
                  : i === stepIdx
                  ? "bg-orange-500 text-white shadow-md shadow-orange-200"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {i < stepIdx ? <CheckCircle size={14} /> : i + 1}
            </div>
            <span
              className={`ml-1.5 text-[11px] font-semibold hidden sm:block ${
                i === stepIdx ? "text-orange-600" : i < stepIdx ? "text-green-600" : "text-gray-400"
              }`}
            >
              {s}
            </span>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 rounded transition-all ${
                  i < stepIdx ? "bg-green-400" : "bg-gray-100"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 leading-relaxed">
          {error}
        </div>
      )}

      {/* ── STEP 1: Mobile Input ──────────────────────────────────────────── */}
      {step === "MOBILE_INPUT" && (
        <div className="space-y-4">
          <div className="text-center mb-2">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-3 border border-orange-100">
              <Phone size={22} className="text-orange-500" />
            </div>
            <h3 className="font-bold text-gray-900">Resume Registration</h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Enter your mobile number to complete verification & set your PIN
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Mobile Number</label>
            <div className="flex gap-2">
              <span className="flex items-center px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500 font-medium">
                +91
              </span>
              <input
                id="verify-mobile"
                type="tel"
                value={mobile}
                onChange={(e) => {
                  setMobile(e.target.value.replace(/\D/g, "").slice(0, 10));
                  setError("");
                }}
                maxLength={10}
                placeholder="10-digit number"
                autoComplete="tel"
                autoFocus
                className={inputCls}
              />
            </div>
          </div>

          <button
            id="verify-send-otp"
            type="button"
            onClick={handleSendOtp}
            disabled={loading || mobile.length !== 10}
            className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl text-sm hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-md shadow-orange-500/20 cursor-pointer"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {loading ? "Sending OTP…" : "Send Verification OTP"}
          </button>

          <div className="border-t border-gray-100 pt-3 text-center">
            <p className="text-xs text-gray-400">
              Haven&apos;t registered yet?{" "}
              <button
                type="button"
                onClick={onSwitchToRegister}
                className="text-orange-600 font-semibold hover:underline cursor-pointer"
              >
                Sign up here
              </button>
            </p>
          </div>
        </div>
      )}

      {/* ── STEP 2: Combined OTP & PIN ────────────────────────────────────── */}
      {step === "VERIFY_AND_PIN" && (
        <form onSubmit={handleCombinedSubmit} className="space-y-4">
          <div className="text-center mb-1">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-2 border border-orange-100">
              <Phone size={22} className="text-orange-500" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm">Verify Mobile & Create PIN</h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              We sent a 6-digit OTP code to <strong className="text-gray-800">+91 {mobile}</strong>.
              Enter the code and set your login PIN below.
            </p>
          </div>

          {/* Section 1: OTP */}
          <div className="p-3.5 bg-orange-50/40 border border-orange-100 rounded-2xl space-y-2">
            <label className="block text-xs font-semibold text-gray-800">
              1. Enter 6-digit OTP Code *
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
              autoFocus
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-lg font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={loading || otpCooldown > 0}
                className="inline-flex items-center gap-1 text-[11px] text-orange-600 hover:text-orange-700 font-semibold disabled:text-gray-400 disabled:cursor-not-allowed cursor-pointer"
              >
                <RefreshCw size={11} />
                {otpCooldown > 0 ? `Resend OTP in ${otpCooldown}s` : "Resend OTP"}
              </button>
            </div>
          </div>

          {/* Section 2: PIN */}
          <div className="p-3.5 bg-gray-50/70 border border-gray-200/80 rounded-2xl space-y-3">
            <label className="block text-xs font-semibold text-gray-800 flex items-center gap-1.5">
              <KeyRound size={14} className="text-orange-500" />
              2. Create Your 6-digit Security PIN *
            </label>

            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Choose PIN
              </label>
              <div className="relative">
                <input
                  id="verify-pin"
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                  placeholder="••••••"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-base font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPin((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  {showPin ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Confirm PIN
              </label>
              <input
                id="verify-confirm-pin"
                type={showPin ? "text" : "password"}
                inputMode="numeric"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                placeholder="••••••"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-base font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              />
            </div>

            {/* Real-time match indicator */}
            {pin.length === 6 && confirmPin.length > 0 && (
              <p className={`text-xs font-medium ${pin === confirmPin ? "text-green-600" : "text-red-500"}`}>
                {pin === confirmPin ? "✓ PINs match" : "✗ PINs do not match"}
              </p>
            )}
          </div>

          {/* Submit button */}
          <button
            id="verify-complete-submit"
            type="submit"
            disabled={loading || otp.length !== 6 || pin.length !== 6 || confirmPin.length !== 6 || pin !== confirmPin}
            className="w-full py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold rounded-xl text-sm hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-md shadow-green-500/20 cursor-pointer"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {loading ? "Verifying & Setting Up…" : "Verify OTP & Complete Account Setup ✓"}
          </button>

          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => {
                setStep("MOBILE_INPUT");
                setError("");
              }}
              className="text-xs text-gray-400 hover:text-gray-600 hover:underline cursor-pointer"
            >
              ← Change mobile number
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
