// src\components\customer\LoginForm.tsx

"use client";

import { useState, useEffect } from "react";
import { Loader2, Eye, EyeOff, RefreshCw, AlertCircle, ShieldCheck } from "lucide-react";
import { getDeviceVisitorId } from "@/lib/fingerprint-client";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { triggerWidgetSendOtp, triggerWidgetVerifyOtp } from "@/lib/msg91-widget-client";

interface Props {
  onSuccess: () => void;
  onSwitchToRegister: () => void;
  onSwitchToVerify: () => void;
}

export default function LoginForm({ onSuccess, onSwitchToRegister, onSwitchToVerify }: Props) {
  const router = useRouter();

  const [mobile, setMobile] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);

  // Forgot PIN state
  const [forgotPin, setForgotPin] = useState(false);
  const [fpMobile, setFpMobile] = useState("");
  const [fpOtp, setFpOtp] = useState("");
  const [fpPreAuth, setFpPreAuth] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [showNewPin, setShowNewPin] = useState(false);
  const [fpStep, setFpStep] = useState<"mobile" | "otp" | "pin">("mobile");
  const [fpOtpCooldown, setFpOtpCooldown] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [infoBox, setInfoBox] = useState<{ message: string; action?: { label: string; href: string } } | null>(null);

  // Cooldown timer for forgot PIN OTP
  useEffect(() => {
    if (fpOtpCooldown <= 0) return;
    const t = setTimeout(() => setFpOtpCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [fpOtpCooldown]);

  // ── PIN Login ──────────────────────────────────────────────────────────────
  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfoBox(null);
    setAttemptsRemaining(null);
    setLoading(true);

    const toastId = toast.loading("Signing you in…");

    try {
      const visitorId = await getDeviceVisitorId();
      const res = await fetch("/api/customer/login-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, pin, deviceVisitorId: visitorId }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.dismiss(toastId);

        // Account setup incomplete — verified mobile but no PIN created
        if (data.code === "NO_PIN") {
          setInfoBox({
            message:
              "Your mobile is verified, but you never created a PIN. Click below to set your PIN — no re-verification needed.",
            action: { label: "Set PIN now →", href: "/verify" },
          });
          return;
        }

        // Locked out
        if (res.status === 429) {
          const msg = data.error ?? "Too many failed attempts. Please wait before trying again.";
          toast.error(msg, { duration: 5000 });
          setError(msg);
          return;
        }

        // Wrong PIN — show attempts remaining
        if (data.attemptsRemaining !== undefined) {
          setAttemptsRemaining(data.attemptsRemaining);
          const remaining = data.attemptsRemaining;
          toast.error(
            remaining > 0
              ? `Incorrect PIN — ${remaining} attempt${remaining !== 1 ? "s" : ""} left before lockout`
              : "Incorrect PIN",
            { duration: 4000 }
          );
          setError("Incorrect PIN. Please try again.");
          return;
        }

        const msg = data.error ?? "Sign in failed. Please try again.";
        toast.error(msg, { duration: 4000 });
        setError(msg);
        return;
      }

      toast.success("Welcome back! 🎉", { id: toastId, duration: 2000 });
      onSuccess();
    } catch {
      toast.error("Connection error. Please check your internet and try again.", { id: toastId });
      setError("Connection error. Please check your internet and try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot PIN: Check mobile before sending OTP ────────────────────────────
  const handleForgotPinSendOtp = async () => {
    setError("");
    setLoading(true);

    const toastId = toast.loading("Checking your account…");

    try {
      const visitorId = await getDeviceVisitorId();

      // Step 1: Check if this mobile is registered and verified
      // We call send-otp with FORGOT_PIN purpose — backend will tell us if unregistered or unverified
      const res = await fetch("/api/customer/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mobile: fpMobile,
          deviceVisitorId: visitorId,
          purpose: "FORGOT_PIN",
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.dismiss(toastId);

        // Mobile not found in system at all (send-otp returns 404 for FORGOT_PIN)
        if (res.status === 404) {
          setError(
            "This number isn't registered with ViTa Cuisine. Please sign up first."
          );
          toast.error("Number not registered — please sign up first.", { duration: 5000 });
          return;
        }

        // Mobile found but not verified — direct them to /verify
        if (data.code === "NOT_VERIFIED" || res.status === 403) {
          setError("");
          setInfoBox({
            message:
              "Your mobile number hasn't been verified yet. Please verify your number and set your PIN first.",
            action: { label: "Go to Verify →", href: "/verify" },
          });
          toast("Verify your mobile first 📱", { duration: 5000, icon: "ℹ️" });
          return;
        }

        // Rate limit
        if (res.status === 429) {
          if (data.waitSeconds) setFpOtpCooldown(data.waitSeconds);
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

      // Step 2: Trigger MSG91 Widget SMS delivery directly on the client
      await triggerWidgetSendOtp(fpMobile);

      toast.success("OTP sent to your mobile!", { id: toastId, duration: 3000 });
      setFpOtpCooldown(60);
      setFpStep("otp");
    } catch (err: any) {
      const msg = err?.message || "Connection error. Please try again.";
      toast.error(msg, { id: toastId });
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot PIN: Verify OTP ─────────────────────────────────────────────────
  const handleForgotPinVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const toastId = toast.loading("Verifying OTP…");

    try {
      // 1. Verify OTP with MSG91 Widget on client to get JWT access token
      let widgetToken: string;
      try {
        widgetToken = await triggerWidgetVerifyOtp(fpMobile, fpOtp);
      } catch (err: any) {
        toast.dismiss(toastId);
        const msg = err?.message || "Incorrect OTP. Please try again.";
        setError(msg);
        toast.error(msg, { duration: 4000 });
        return;
      }

      // 2. Verify token with backend
      const res = await fetch("/api/customer/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: fpMobile, widgetToken, purpose: "FORGOT_PIN" }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.dismiss(toastId);
        const msg =
          res.status === 404
            ? "OTP has expired. Please request a new one."
            : data.error ?? "Incorrect OTP. Please try again.";
        setError(msg);
        toast.error(msg, { duration: 4000 });
        return;
      }

      toast.success("OTP verified! Now set your new PIN.", { id: toastId, duration: 3000 });
      setFpPreAuth(data.preAuthToken);
      setFpStep("pin");
    } catch (err: any) {
      const msg = err?.message || "Connection error. Please try again.";
      toast.error(msg, { id: toastId });
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot PIN: Reset PIN ──────────────────────────────────────────────────
  const handleForgotPinReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPin !== confirmNewPin) {
      toast.error("PINs don't match — please re-enter.");
      setError("PINs do not match. Please re-enter.");
      return;
    }

    const simplePins = [
      "000000", "111111", "222222", "333333", "444444",
      "555555", "666666", "777777", "888888", "999999",
      "123456", "654321", "012345", "098765",
    ];
    if (simplePins.includes(newPin)) {
      toast.error("PIN is too simple — choose something harder to guess.");
      setError("This PIN is too simple. Please choose a less obvious 6-digit number.");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Setting your new PIN…");

    try {
      const visitorId = await getDeviceVisitorId();
      const res = await fetch("/api/customer/set-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preAuthToken: fpPreAuth,
          pin: newPin,
          confirmPin: confirmNewPin,
          deviceVisitorId: visitorId,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.dismiss(toastId);
        if (res.status === 401) {
          setFpPreAuth("");
          setFpOtp("");
          setFpStep("otp");
          const msg = "Your session timed out. Please re-enter your OTP.";
          setError(msg);
          toast.error(msg, { duration: 4000 });
          return;
        }
        const msg = data.error ?? "Could not set PIN. Please try again.";
        setError(msg);
        toast.error(msg, { duration: 4000 });
        return;
      }

      toast.success("PIN set! You're now signed in. 🎉", { id: toastId, duration: 2000 });
      onSuccess();
    } catch {
      toast.error("Connection error. Please try again.", { id: toastId });
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetForgotPin = () => {
    setForgotPin(false);
    setFpStep("mobile");
    setFpOtp("");
    setFpPreAuth("");
    setNewPin("");
    setConfirmNewPin("");
    setFpOtpCooldown(0);
    setError("");
    setInfoBox(null);
  };

  // ── Forgot PIN flow ────────────────────────────────────────────────────────
  if (forgotPin) {
    return (
      <div className="space-y-4">
        {/* Back + Title */}
        <div className="flex items-center gap-2 mb-2">
          <button
            type="button"
            onClick={resetForgotPin}
            className="text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
          >
            ← Back
          </button>
          <h3 className="font-bold text-gray-900 text-sm">Reset Your PIN</h3>
        </div>

        {/* Info box (e.g., "not verified — go verify") */}
        {infoBox && !error && (
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 space-y-2">
            <div className="flex gap-2">
              <AlertCircle size={14} className="shrink-0 mt-0.5 text-blue-500" />
              <span>{infoBox.message}</span>
            </div>
            {infoBox.action && (
              <button
                type="button"
                onClick={() => router.push(infoBox.action!.href)}
                className="ml-5 font-semibold text-blue-600 hover:underline cursor-pointer text-xs"
              >
                {infoBox.action.label}
              </button>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 leading-relaxed">
            {error}
          </div>
        )}

        {/* Mobile step */}
        {fpStep === "mobile" && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 leading-relaxed">
              Enter the mobile number you registered with. We&apos;ll send you a one-time code to verify it&apos;s you.
            </p>
            <div className="flex gap-2">
              <span className="flex items-center px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500">
                +91
              </span>
              <input
                id="fp-mobile"
                type="tel"
                value={fpMobile}
                onChange={(e) => {
                  setFpMobile(e.target.value.replace(/\D/g, "").slice(0, 10));
                  setError("");
                  setInfoBox(null);
                }}
                maxLength={10}
                placeholder="10-digit number"
                autoComplete="tel"
                autoFocus
                className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all"
              />
            </div>
            <button
              id="fp-send-otp"
              type="button"
              onClick={handleForgotPinSendOtp}
              disabled={loading || fpMobile.length !== 10 || fpOtpCooldown > 0}
              className="w-full py-2.5 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {fpOtpCooldown > 0 ? `Resend in ${fpOtpCooldown}s` : "Send OTP"}
            </button>
          </div>
        )}

        {/* OTP step */}
        {fpStep === "otp" && (
          <form onSubmit={handleForgotPinVerifyOtp} className="space-y-3">
            <p className="text-xs text-gray-500 leading-relaxed">
              We sent a 6-digit code to{" "}
              <strong className="text-gray-800">+91 {fpMobile}</strong>. Enter it below.
            </p>
            <input
              id="fp-otp"
              type="text"
              inputMode="numeric"
              value={fpOtp}
              onChange={(e) => setFpOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
              placeholder="••••••"
              autoComplete="one-time-code"
              autoFocus
              className="w-full px-3.5 py-3 border border-gray-200 rounded-xl text-lg font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all"
            />
            <button
              id="fp-verify-otp"
              type="submit"
              disabled={loading || fpOtp.length !== 6}
              className="w-full py-2.5 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              Verify OTP
            </button>

            {/* Resend with countdown */}
            <div className="text-center">
              <button
                type="button"
                onClick={handleForgotPinSendOtp}
                disabled={loading || fpOtpCooldown > 0}
                className="inline-flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-700 font-semibold disabled:text-gray-400 disabled:cursor-not-allowed cursor-pointer"
              >
                <RefreshCw size={11} />
                {fpOtpCooldown > 0 ? `Resend OTP in ${fpOtpCooldown}s` : "Resend OTP"}
              </button>
            </div>
          </form>
        )}

        {/* New PIN step */}
        {fpStep === "pin" && (
          <form onSubmit={handleForgotPinReset} className="space-y-3">
            <div className="flex items-center gap-2 py-2 px-3 bg-green-50 border border-green-100 rounded-xl">
              <ShieldCheck size={14} className="text-green-600 shrink-0" />
              <p className="text-xs text-green-700">Identity verified! Now create your new PIN.</p>
            </div>

            <div className="relative">
              <input
                id="fp-new-pin"
                type={showNewPin ? "text" : "password"}
                inputMode="numeric"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                placeholder="New 6-digit PIN"
                autoFocus
                className="w-full px-3.5 py-3 border border-gray-200 rounded-xl text-lg font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPin((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                {showNewPin ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <input
              id="fp-confirm-pin"
              type={showNewPin ? "text" : "password"}
              inputMode="numeric"
              value={confirmNewPin}
              onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
              placeholder="Confirm new PIN"
              className="w-full px-3.5 py-3 border border-gray-200 rounded-xl text-lg font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all"
            />

            {/* Real-time PIN match feedback */}
            {newPin.length === 6 && confirmNewPin.length > 0 && (
              <p className={`text-xs ${newPin === confirmNewPin ? "text-green-600" : "text-red-500"}`}>
                {newPin === confirmNewPin ? "✓ PINs match" : "✗ PINs don't match"}
              </p>
            )}

            <p className="text-[10px] text-gray-400">
              Tip: Avoid easy-to-guess numbers like 123456 or your birth year.
            </p>

            <button
              id="fp-reset"
              type="submit"
              disabled={
                loading ||
                newPin.length !== 6 ||
                confirmNewPin.length !== 6 ||
                newPin !== confirmNewPin
              }
              className="w-full py-2.5 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              Set New PIN & Sign In
            </button>
          </form>
        )}
      </div>
    );
  }

  // ── Normal Login form ──────────────────────────────────────────────────────
  return (
    <div>
      {/* Info box for NO_PIN case */}
      {infoBox && !error && (
        <div className="mb-3 p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 space-y-2">
          <div className="flex gap-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5 text-blue-500" />
            <span className="leading-relaxed">{infoBox.message}</span>
          </div>
          {infoBox.action && (
            <button
              type="button"
              onClick={() => router.push(infoBox.action!.href)}
              className="ml-5 font-semibold text-blue-600 hover:underline cursor-pointer text-xs"
            >
              {infoBox.action.label}
            </button>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
          {error}
          {attemptsRemaining !== null && attemptsRemaining > 0 && (
            <p className="text-xs mt-1 text-red-500">
              {attemptsRemaining} attempt{attemptsRemaining !== 1 ? "s" : ""} left before your
              account is locked for 15 minutes.
            </p>
          )}
        </div>
      )}

      <form onSubmit={handlePinLogin} className="space-y-3">
        {/* Mobile */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Mobile Number</label>
          <div className="flex gap-2">
            <span className="flex items-center px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500">
              +91
            </span>
            <input
              id="login-mobile"
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
              maxLength={10}
              placeholder="10-digit number"
              autoComplete="tel"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all"
            />
          </div>
        </div>

        {/* PIN */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">PIN</label>
          <div className="relative">
            <input
              id="login-pin"
              type={showPin ? "text" : "password"}
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
              placeholder="••••••"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-lg font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPin((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <button
          id="login-pin-submit"
          type="submit"
          disabled={loading || mobile.length !== 10 || pin.length !== 6}
          className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl text-sm hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-md shadow-orange-500/20 cursor-pointer"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          Sign In
        </button>

        <div className="flex items-center justify-between text-xs pt-1">
          <button
            type="button"
            onClick={() => {
              setFpMobile(mobile); // pre-fill from login form
              setForgotPin(true);
              setError("");
              setInfoBox(null);
            }}
            className="text-orange-600 hover:underline font-semibold cursor-pointer"
          >
            Forgot PIN?
          </button>
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="text-gray-500 hover:text-gray-700 cursor-pointer"
          >
            New here?{" "}
            <span className="text-orange-600 font-semibold">Sign up</span>
          </button>
        </div>
      </form>
    </div>
  );
}
