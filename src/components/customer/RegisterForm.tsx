// src\components\customer\RegisterForm.tsx

"use client";

import { useState, useEffect } from "react";
import { Loader2, Building2, Phone, KeyRound, Eye, EyeOff, Home, Lock, CheckCircle, RefreshCw } from "lucide-react";
import { getDeviceVisitorId } from "@/lib/fingerprint-client";
import toast from "react-hot-toast";
import { triggerWidgetSendOtp, triggerWidgetVerifyOtp } from "@/lib/msg91-widget-client";
import CompanySearchCombobox from "@/components/customer/CompanySearchCombobox";

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = "DETAILS" | "VERIFY_AND_PIN";
type OrderingMode = "WORK" | "HOME_ONLY";

interface Company {
  id: string;
  name: string;
  address?: string | null;
  location?: string | null;
}

interface Props {
  onSuccess: () => void;
  onSwitchToLogin: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hasCanonicalAddress(c: Company | undefined | null): boolean {
  return !!c?.address && c.address.trim().length >= 5;
}

function combineAddress(line1: string, line2: string, landmark: string): string {
  const parts = [line1.trim(), line2.trim(), landmark.trim()].filter(Boolean);
  return parts.join(", ");
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RegisterForm({ onSuccess, onSwitchToLogin }: Props) {
  const [step, setStep] = useState<Step>("DETAILS");

  // Step 1 state
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [orderingMode, setOrderingMode] = useState<OrderingMode>("WORK");
  
  // Work address state
  const [workLine1, setWorkLine1] = useState("");
  const [workLine2, setWorkLine2] = useState("");
  const [workLandmark, setWorkLandmark] = useState("");

  // Home address state
  const [homeLine1, setHomeLine1] = useState("");
  const [homeLine2, setHomeLine2] = useState("");
  const [homeLandmark, setHomeLandmark] = useState("");

  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [newCompany, setNewCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [draftId, setDraftId] = useState("");

  // Step 2 state (OTP + PIN combined)
  const [otp, setOtp] = useState("");
  const [, setOtpSent] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Load companies ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/customer/companies")
      .then((r) => r.json())
      .then((d) => setCompanies(d.companies ?? []))
      .catch(() => {});
  }, []);

  // ── OTP resend cooldown timer ───────────────────────────────────────────────
  useEffect(() => {
    if (otpCooldown <= 0) {
      setError((prev) => (/Please wait \d+ second/i.test(prev) ? "" : prev));
      return;
    }
    const t = setTimeout(() => setOtpCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCooldown]);

  // ── Auto-fill & lock work address when selected company changes ────────────
  const selectedCompany = companies.find((c) => c.id === companyId);
  const workAddressLocked =
    orderingMode === "WORK" && !newCompany && !!companyId && hasCanonicalAddress(selectedCompany);

  useEffect(() => {
    if (newCompany || !companyId) return;
    const selected = companies.find((c) => c.id === companyId);
    if (hasCanonicalAddress(selected)) {
      setWorkLine1(selected!.address!.trim());
      setWorkLine2("");
      setWorkLandmark("");
    } else {
      setWorkLine1("");
      setWorkLine2("");
      setWorkLandmark("");
    }
  }, [companyId, newCompany, companies]);

  // Derived formatted addresses
  const computedWorkAddress = workAddressLocked
    ? selectedCompany!.address!.trim()
    : combineAddress(workLine1, workLine2, workLandmark);

  const computedHomeAddress = combineAddress(homeLine1, homeLine2, homeLandmark);

  // ── Step 1: Submit details ──────────────────────────────────────────────────
  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!fullName.trim() || fullName.trim().length < 2 || fullName.trim().length > 80) {
      setError("Full name must be between 2 and 80 characters.");
      return;
    }

    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(mobile)) {
      setError("Please enter a valid 10-digit Indian mobile number.");
      return;
    }

    if (orderingMode === "HOME_ONLY") {
      if (!homeLine1.trim() || homeLine1.trim().length < 5) {
        setError("Home Address Line 1 must be at least 5 characters.");
        return;
      }
    } else {
      if (!newCompany && !companyId) {
        setError("Please select a company.");
        return;
      }

      if (newCompany && (!newCompanyName.trim() || newCompanyName.trim().length < 2 || newCompanyName.trim().length > 100)) {
        setError("Company name must be between 2 and 100 characters.");
        return;
      }

      if (!workAddressLocked && (!workLine1.trim() || workLine1.trim().length < 5)) {
        setError("Work Address Line 1 must be at least 5 characters.");
        return;
      }
    }

    setLoading(true);
    const toastId = toast.loading("Saving your details…");

    try {
      const visitorId = await getDeviceVisitorId();

      const res = await fetch("/api/customer/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          mobile,                // ← real number stored immediately, no placeholder
          orderingMode,
          workAddress: orderingMode === "WORK" ? computedWorkAddress : undefined,
          homeAddress: orderingMode === "HOME_ONLY" ? computedHomeAddress : undefined,
          companyId: orderingMode === "WORK" && !newCompany ? companyId : undefined,
          newCompanyName: orderingMode === "WORK" && newCompany ? newCompanyName.trim() : undefined,
          deviceVisitorId: visitorId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.dismiss(toastId);
        // Duplicate mobile — caught now at register stage (not just send-otp)
        if (data.error === "MOBILE_ALREADY_REGISTERED") {
          if (data.code === "VERIFIED_NO_PIN") {
            const msg = "Your mobile is already verified — please set your PIN.";
            setError(msg);
            toast.error(msg, { duration: 5000 });
          } else {
            toast.error("This number is already registered — redirecting to Login...", {
              id: toastId,
              duration: 3000,
            });
            setTimeout(() => onSwitchToLogin(), 1200);
          }
          return;
        }
        const msg = data.error ?? "Registration failed. Please try again.";
        setError(msg);
        toast.error(msg, { duration: 4000 });
        return;
      }

      const registeredDraftId = data.draftId;
      setDraftId(registeredDraftId);

      toast.loading("Sending OTP to your mobile…", { id: toastId });

      const otpRes = await fetch("/api/customer/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: registeredDraftId,
          mobile,
          deviceVisitorId: visitorId,
          purpose: "REGISTER",
        }),
      });

      const otpData = await otpRes.json();

      if (!otpRes.ok) {
        toast.dismiss(toastId);
        if (otpData.error === "MOBILE_ALREADY_REGISTERED") {
          toast.error("This number is already registered — redirecting to Login...", {
            id: toastId,
            duration: 3000,
          });
          setTimeout(() => onSwitchToLogin(), 1200);
          return;
        }
        if (otpRes.status === 429) {
          // Start the live countdown so the number ticks down rather than staying frozen
          if (otpData.waitSeconds) setOtpCooldown(otpData.waitSeconds);
          const msg = otpData.error ?? "Too many OTP requests. Please wait a moment.";
          setError(msg);
          toast.error(msg, { duration: 5000 });
          // Move to step 2 so the user sees the ticking "Resend OTP in Xs" button
          setOtpSent(true);
          setStep("VERIFY_AND_PIN");
          return;
        }
        const msg = otpData.error ?? "Could not send OTP. Please try again.";
        setError(msg);
        toast.error(msg, { duration: 4000 });
        return;
      }

      // Backend only rate-limited and created the OtpVerification row — the SMS
      // itself is sent by the MSG91 Widget JS running on this page.
      try {
        await triggerWidgetSendOtp(mobile);
      } catch (err: any) {
        toast.dismiss(toastId);
        const msg = err?.message || "Could not send OTP. Please try again.";
        setError(msg);
        toast.error(msg, { duration: 4000 });
        return;
      }

      toast.success("OTP sent to your mobile! Enter OTP & set your PIN below.", { id: toastId, duration: 4000 });
      setOtpSent(true);
      setOtpCooldown(60);
      setStep("VERIFY_AND_PIN");
    } catch {
      toast.error("Connection error. Please check your internet and try again.", { id: toastId });
      setError("Connection error. Please check your internet and try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP ─────────────────────────────────────────────────────────────
  const handleResendOtp = async () => {
    setError("");
    setLoading(true);
    const toastId = toast.loading("Resending OTP…");

    try {
      const visitorId = await getDeviceVisitorId();
      const res = await fetch("/api/customer/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId,
          mobile,
          deviceVisitorId: visitorId,
          purpose: "REGISTER",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.dismiss(toastId);
        if (data.error === "MOBILE_ALREADY_REGISTERED") {
          const msg = "This number is already registered. Please use the Login tab.";
          setError(msg);
          toast.error(msg, { duration: 5000 });
          return;
        }
        if (res.status === 429) {
          const msg = data.error ?? "Too many OTP requests. Please wait a moment.";
          setError(msg);
          toast.error(msg, { duration: 5000 });
          return;
        }
        const msg = data.error ?? "Could not send OTP. Please try again.";
        setError(msg);
        toast.error(msg, { duration: 4000 });
        return;
      }

      try {
        await triggerWidgetSendOtp(mobile);
      } catch (err: any) {
        toast.dismiss(toastId);
        const msg = err?.message || "Could not resend OTP. Please try again.";
        setError(msg);
        toast.error(msg, { duration: 4000 });
        return;
      }

      toast.success("OTP resent! Check your SMS.", { id: toastId, duration: 3000 });
      setOtpSent(true);
      setOtpCooldown(60);
    } catch {
      toast.error("Connection error. Please try again.", { id: toastId });
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Combined OTP Verification & PIN Creation ────────────────────────
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
    const toastId = toast.loading("Verifying OTP & creating account…");

    try {
      const visitorId = await getDeviceVisitorId();

      // 1. Verify the typed OTP with the MSG91 Widget to get a JWT access token.
      let widgetToken: string;
      try {
        widgetToken = await triggerWidgetVerifyOtp(mobile, otp);
      } catch (err: any) {
        toast.dismiss(toastId);
        const msg = err?.message || "Incorrect OTP. Please check and try again.";
        setError(msg);
        toast.error(msg, { duration: 4000 });
        return;
      }

      // 2. Send that token (not the raw code) to our backend, which validates it
      // with MSG91's verifyAccessToken endpoint.
      const verifyRes = await fetch("/api/customer/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, widgetToken, purpose: "REGISTER" }),
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

      // 2. Immediately set PIN (atomic chain, no UI split)
      const pinRes = await fetch("/api/customer/set-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId, preAuthToken, pin, confirmPin, deviceVisitorId: visitorId }),
      });

      const pinData = await pinRes.json();

      if (!pinRes.ok) {
        toast.dismiss(toastId);
        const msg = pinData.error ?? "Could not set PIN. Please try again.";
        setError(msg);
        toast.error(msg, { duration: 4000 });
        return;
      }

      toast.success("Account created! Welcome to ViTa Cuisine 🎉", { id: toastId, duration: 2500 });
      onSuccess();
    } catch {
      toast.error("Connection error. Please try again.", { id: toastId });
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step indicators (2 steps now!) ──────────────────────────────────────────
  const steps = ["Details", "Verify & Set PIN"];
  const currentStepIdx = step === "DETAILS" ? 0 : 1;

  const inputCls =
    "w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all bg-white text-gray-800 placeholder-gray-400";

  return (
    <div className="space-y-4">
      {/* ── Step Indicator ──────────────────────────────────────────────────── */}
      <div className="flex items-center mb-5">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center flex-1">
            <div
              className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                i < currentStepIdx
                  ? "bg-green-500 text-white"
                  : i === currentStepIdx
                  ? "bg-orange-500 text-white shadow-md shadow-orange-200"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {i < currentStepIdx ? <CheckCircle size={14} /> : i + 1}
            </div>
            <span
              className={`ml-1.5 text-[11px] font-semibold hidden sm:block ${
                i === currentStepIdx
                  ? "text-orange-600"
                  : i < currentStepIdx
                  ? "text-green-600"
                  : "text-gray-400"
              }`}
            >
              {s}
            </span>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 rounded transition-all ${
                  i < currentStepIdx ? "bg-green-400" : "bg-gray-100"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 leading-relaxed">
          {otpCooldown > 0 && /Please wait \d+ second/i.test(error)
            ? `Please wait ${otpCooldown} second${otpCooldown === 1 ? "" : "s"} before requesting another OTP.`
            : error}
        </div>
      )}

      {/* ── STEP 1: Details ─────────────────────────────────────────────────── */}
      {step === "DETAILS" && (
        <form onSubmit={handleDetailsSubmit} className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Full Name *
            </label>
            <input
              id="register-fullname"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="Your full name"
              autoFocus
              className={inputCls}
            />
          </div>

          {/* Mobile */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Mobile Number *
            </label>
            <div className="flex gap-2">
              <span className="flex items-center px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500 font-medium">
                +91
              </span>
              <input
                id="register-mobile"
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                required
                maxLength={10}
                placeholder="10-digit mobile number"
                autoComplete="tel"
                className={inputCls}
              />
            </div>
          </div>

          {/* Ordering Mode Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Where will you order most often? *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOrderingMode("WORK")}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  orderingMode === "WORK"
                    ? "border-orange-500 bg-orange-50/60 text-orange-600 shadow-sm"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                <Building2 size={15} />
                Office / Work
              </button>
              <button
                type="button"
                onClick={() => setOrderingMode("HOME_ONLY")}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  orderingMode === "HOME_ONLY"
                    ? "border-orange-500 bg-orange-50/60 text-orange-600 shadow-sm"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                <Home size={15} />
                Home Only
              </button>
            </div>
          </div>

          {/* WORK mode fields */}
          {orderingMode === "WORK" && (
            <div className="space-y-3 p-3.5 bg-gray-50/70 border border-gray-200/80 rounded-2xl">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Company / Workplace *
                </label>

                {!newCompany ? (
                  <CompanySearchCombobox
                    companies={companies}
                    selectedCompanyId={companyId}
                    onSelectCompany={(id) => setCompanyId(id)}
                    onAddNewCompany={() => {
                      setNewCompany(true);
                      setCompanyId("");
                    }}
                  />
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        id="register-new-company-input"
                        type="text"
                        value={newCompanyName}
                        onChange={(e) => setNewCompanyName(e.target.value)}
                        placeholder="Type your company name"
                        className={inputCls}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setNewCompany(false);
                          setNewCompanyName("");
                        }}
                        className="px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl bg-white shrink-0 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Work Address Fields */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center justify-between">
                  <span>Work Address *</span>
                  {workAddressLocked && (
                    <span className="text-[10px] text-green-600 font-normal flex items-center gap-1">
                      <Lock size={10} /> Auto-filled from company
                    </span>
                  )}
                </label>

                {workAddressLocked ? (
                  <div className="p-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-700 font-medium leading-relaxed">
                    {selectedCompany!.address}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      id="register-work-line1"
                      type="text"
                      value={workLine1}
                      onChange={(e) => setWorkLine1(e.target.value)}
                      placeholder="Building, Floor, Suite / Desk location *"
                      className={inputCls}
                    />
                    <input
                      id="register-work-line2"
                      type="text"
                      value={workLine2}
                      onChange={(e) => setWorkLine2(e.target.value)}
                      placeholder="Area / Street (optional)"
                      className={inputCls}
                    />
                    <input
                      id="register-work-landmark"
                      type="text"
                      value={workLandmark}
                      onChange={(e) => setWorkLandmark(e.target.value)}
                      placeholder="Landmark (e.g. Near Main Gate) (optional)"
                      className={inputCls}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* HOME_ONLY mode fields */}
          {orderingMode === "HOME_ONLY" && (
            <div className="space-y-2 p-3.5 bg-gray-50/70 border border-gray-200/80 rounded-2xl">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Home Delivery Address *
              </label>
              <input
                id="register-home-line1"
                type="text"
                value={homeLine1}
                onChange={(e) => setHomeLine1(e.target.value)}
                placeholder="House / Flat / Building No. & Street *"
                className={inputCls}
              />
              <input
                id="register-home-line2"
                type="text"
                value={homeLine2}
                onChange={(e) => setHomeLine2(e.target.value)}
                placeholder="Area / Colony (optional)"
                className={inputCls}
              />
              <input
                id="register-home-landmark"
                type="text"
                value={homeLandmark}
                onChange={(e) => setHomeLandmark(e.target.value)}
                placeholder="Landmark (optional)"
                className={inputCls}
              />
            </div>
          )}

          {/* Submit Step 1 button */}
          <button
            id="register-submit-details"
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl text-sm hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-md shadow-orange-500/20 cursor-pointer"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {loading ? "Processing…" : "Continue to Verification →"}
          </button>

          <div className="text-center pt-1">
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer"
            >
              Already have an account?{" "}
              <span className="text-orange-600 font-semibold">Sign in</span>
            </button>
          </div>
        </form>
      )}

      {/* ── STEP 2: Combined OTP Verification + PIN Creation ──────────────── */}
      {step === "VERIFY_AND_PIN" && (
        <form onSubmit={handleCombinedSubmit} className="space-y-4">
          <div className="text-center mb-1">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-2 border border-orange-100">
              <Phone size={22} className="text-orange-500" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm">Verify Mobile & Create PIN</h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              We sent a 6-digit OTP code to <strong className="text-gray-800">+91 {mobile}</strong>.
              Enter it below and set your login PIN to complete registration in one step.
            </p>
          </div>

          {/* Section 1: OTP Code */}
          <div className="p-3.5 bg-orange-50/40 border border-orange-100 rounded-2xl space-y-2">
            <label className="block text-xs font-semibold text-gray-800">
              1. Enter 6-digit OTP Code *
            </label>
            <input
              id="register-otp"
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
                onClick={handleResendOtp}
                disabled={loading || otpCooldown > 0}
                className="inline-flex items-center gap-1 text-[11px] text-orange-600 hover:text-orange-700 font-semibold disabled:text-gray-400 disabled:cursor-not-allowed cursor-pointer"
              >
                <RefreshCw size={11} />
                {otpCooldown > 0 ? `Resend OTP in ${otpCooldown}s` : "Resend OTP"}
              </button>
            </div>
          </div>

          {/* Section 2: PIN Creation */}
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
                  id="register-pin"
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
                id="register-confirm-pin"
                type={showPin ? "text" : "password"}
                inputMode="numeric"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                placeholder="••••••"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-base font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              />
            </div>

            {/* Real-time PIN match indicator */}
            {pin.length === 6 && confirmPin.length > 0 && (
              <p className={`text-xs font-medium ${pin === confirmPin ? "text-green-600" : "text-red-500"}`}>
                {pin === confirmPin ? "✓ PINs match" : "✗ PINs do not match"}
              </p>
            )}
          </div>

          {/* Submit combined button */}
          <button
            id="register-complete-submit"
            type="submit"
            disabled={loading || otp.length !== 6 || pin.length !== 6 || confirmPin.length !== 6 || pin !== confirmPin}
            className="w-full py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold rounded-xl text-sm hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-md shadow-green-500/20 cursor-pointer"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {loading ? "Creating Account…" : "Verify OTP & Complete Account Setup ✓"}
          </button>

          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => {
                setStep("DETAILS");
                setError("");
              }}
              className="text-xs text-gray-400 hover:text-gray-600 hover:underline cursor-pointer"
            >
              ← Edit details / mobile number
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
