// src\components\customer\RegisterForm.tsx

"use client";

import { useState, useEffect } from "react";
import { ChevronRight, Loader2, Building2, Plus, Phone, KeyRound, Eye, EyeOff, Home, Lock, MapPin } from "lucide-react";
import { getDeviceVisitorId } from "@/lib/fingerprint-client";

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = "DETAILS" | "OTP" | "PIN";
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

  // Step 2 state
  const [otp, setOtp] = useState("");
  const [preAuthToken, setPreAuthToken] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);

  // Step 3 state
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
    if (otpCooldown <= 0) return;
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

    try {
      const visitorId = await getDeviceVisitorId();

      const res = await fetch("/api/customer/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
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
        setError(data.error ?? "Registration failed");
        return;
      }

      const registeredDraftId = data.draftId;
      setDraftId(registeredDraftId);

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
        if (otpData.error === "MOBILE_ALREADY_REGISTERED") {
          setError("This number is already registered. Please go to the Login page.");
          return;
        }
        setError(otpData.error ?? "Failed to send OTP");
        return;
      }

      setOtpSent(true);
      setOtpCooldown(60);
      setStep("OTP");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2a: Resend OTP ─────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    setError("");
    setLoading(true);

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
        if (data.error === "MOBILE_ALREADY_REGISTERED") {
          setError("This number is already registered. Please go to the Login page.");
          return;
        }
        setError(data.error ?? "Failed to send OTP");
        return;
      }

      setOtpSent(true);
      setOtpCooldown(60);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2b: Verify OTP ─────────────────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (otp.length !== 6) {
      setError("OTP must be exactly 6 digits.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/customer/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, otp, purpose: "REGISTER" }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "OTP verification failed");
        return;
      }

      setPreAuthToken(data.preAuthToken);
      setStep("PIN");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Complete registration (Set PIN) ──────────────────────────────────
  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (pin.length !== 6) {
      setError("PIN must be exactly 6 digits.");
      return;
    }

    if (pin !== confirmPin) {
      setError("PINs do not match.");
      return;
    }

    const simplePins = [
      "000000", "111111", "222222", "333333", "444444", "555555", "666666", "777777", "888888", "999999",
      "123456", "654321"
    ];
    if (simplePins.includes(pin)) {
      setError("PIN is too simple. Please choose a more secure PIN.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/customer/set-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId, preAuthToken, pin, confirmPin }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          setPreAuthToken("");
          setOtp("");
          setOtpSent(false);
          setOtpCooldown(0);
          setStep("OTP");
          setError("Your verification session expired. Please re-verify your mobile number to continue.");
          return;
        }
        setError(data.error ?? "Failed to set PIN");
        return;
      }

      onSuccess();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step indicators ─────────────────────────────────────────────────────────
  const steps = ["Details", "Verify Mobile", "Set PIN"];
  const currentStepIdx = step === "DETAILS" ? 0 : step === "OTP" ? 1 : 2;

  const inputCls =
    "w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all bg-white text-gray-800 placeholder-gray-400";

  return (
    <div>
      {/* Step indicator */}
      <div className="flex items-center mb-5">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center flex-1">
            <div
              className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                i <= currentStepIdx
                  ? "bg-orange-500 text-white"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {i < currentStepIdx ? "✓" : i + 1}
            </div>
            <span
              className={`ml-1.5 text-xs font-medium hidden sm:block ${
                i === currentStepIdx ? "text-orange-600" : "text-gray-400"
              }`}
            >
              {s}
            </span>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 rounded ${
                  i < currentStepIdx ? "bg-orange-400" : "bg-gray-100"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
          {error}
        </div>
      )}

      {/* ── STEP 1: DETAILS ──────────────────────────────────────────────────── */}
      {step === "DETAILS" && (
        <form onSubmit={handleDetailsSubmit} className="space-y-3.5">
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
              minLength={2}
              maxLength={80}
              placeholder="Your full name"
              className={inputCls}
            />
          </div>

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
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Delivery mode toggle */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Where should we deliver? *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                id="ordering-mode-work"
                onClick={() => setOrderingMode("WORK")}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${
                  orderingMode === "WORK"
                    ? "border-orange-500 bg-orange-500 text-white shadow-sm"
                    : "border-gray-200 text-gray-600 hover:border-gray-300 bg-white"
                }`}
              >
                <Building2 size={14} /> Work (via Company)
              </button>
              <button
                type="button"
                id="ordering-mode-home"
                onClick={() => setOrderingMode("HOME_ONLY")}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${
                  orderingMode === "HOME_ONLY"
                    ? "border-orange-500 bg-orange-500 text-white shadow-sm"
                    : "border-gray-200 text-gray-600 hover:border-gray-300 bg-white"
                }`}
              >
                <Home size={14} /> Home Only
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              {orderingMode === "WORK"
                ? "We'll deliver to your workplace via your company."
                : "We'll deliver directly to your home address — no company needed."}
            </p>
          </div>

          {/* WORK MODE: Render Company Selector + Work Address ONLY */}
          {orderingMode === "WORK" && (
            <div className="space-y-3 pt-1 border-t border-gray-100">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                  <Building2 size={13} className="text-orange-500" /> Company *
                </label>

                {!newCompany ? (
                  <div className="flex gap-2">
                    <select
                      id="register-company-select"
                      value={companyId}
                      onChange={(e) => setCompanyId(e.target.value)}
                      className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-white transition-all text-gray-800"
                    >
                      <option value="">Select company...</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => { setNewCompany(true); setCompanyId(""); setWorkLine1(""); setWorkLine2(""); setWorkLandmark(""); }}
                      className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-semibold px-3 py-2 border border-orange-200 rounded-xl hover:bg-orange-50 transition-colors shrink-0 cursor-pointer"
                    >
                      <Plus size={14} /> New
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      id="register-new-company"
                      type="text"
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      placeholder="Enter company name"
                      maxLength={120}
                      className="flex-1 px-3 py-2 border border-orange-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => { setNewCompany(false); setNewCompanyName(""); setWorkLine1(""); setWorkLine2(""); setWorkLandmark(""); }}
                      className="text-xs text-gray-500 hover:text-gray-700 px-3 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shrink-0 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Work Address: locked if company address is present; 3-field input otherwise */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                  <MapPin size={13} className="text-orange-500" /> Work / Delivery Address *
                </label>
                {workAddressLocked ? (
                  <div className="w-full px-3.5 py-3 border border-orange-200 bg-orange-50/50 rounded-xl text-sm text-gray-800 font-medium flex items-start gap-2.5">
                    <Lock size={15} className="text-orange-500 mt-0.5 shrink-0" />
                    <span>{selectedCompany!.address}</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      id="register-work-line1"
                      type="text"
                      value={workLine1}
                      onChange={(e) => setWorkLine1(e.target.value)}
                      required
                      minLength={5}
                      maxLength={150}
                      placeholder="Address line 1 *"
                      className={inputCls}
                    />
                    <input
                      id="register-work-line2"
                      type="text"
                      value={workLine2}
                      onChange={(e) => setWorkLine2(e.target.value)}
                      maxLength={150}
                      placeholder="Floor / Building (optional)"
                      className={inputCls}
                    />
                    <input
                      id="register-work-landmark"
                      type="text"
                      value={workLandmark}
                      onChange={(e) => setWorkLandmark(e.target.value)}
                      maxLength={150}
                      placeholder="Landmark (optional)"
                      className={inputCls}
                    />
                  </div>
                )}
                <p className="text-[10px] text-gray-400 mt-1">
                  {workAddressLocked
                    ? "This address is set by your company and cannot be changed here."
                    : companyId && !newCompany
                    ? "This company doesn't have a saved address yet — the address you enter will be saved as your delivery location."
                    : ""}
                </p>
              </div>
            </div>
          )}

          {/* HOME ONLY MODE: Render Home Address ONLY */}
          {orderingMode === "HOME_ONLY" && (
            <div className="space-y-2 pt-1 border-t border-gray-100">
              <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                <Home size={13} className="text-orange-500" /> Home Delivery Address *
              </label>
              <input
                id="register-home-line1"
                type="text"
                value={homeLine1}
                onChange={(e) => setHomeLine1(e.target.value)}
                required
                minLength={5}
                maxLength={150}
                placeholder="Address line 1 *"
                className={inputCls}
              />
              <input
                id="register-home-line2"
                type="text"
                value={homeLine2}
                onChange={(e) => setHomeLine2(e.target.value)}
                maxLength={150}
                placeholder="Floor / Building (optional)"
                className={inputCls}
              />
              <input
                id="register-home-landmark"
                type="text"
                value={homeLandmark}
                onChange={(e) => setHomeLandmark(e.target.value)}
                maxLength={150}
                placeholder="Landmark (optional)"
                className={inputCls}
              />
            </div>
          )}

          <button
            id="register-step1-submit"
            type="submit"
            disabled={
              loading ||
              !fullName.trim() ||
              mobile.length !== 10 ||
              (orderingMode === "HOME_ONLY"
                ? !homeLine1.trim()
                : (
                    (!workAddressLocked && !workLine1.trim()) ||
                    (!newCompany && !companyId) ||
                    (newCompany && !newCompanyName.trim())
                  ))
            }
            className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl text-sm hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-md shadow-orange-500/20 mt-3 cursor-pointer"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            Continue
            {!loading && <ChevronRight size={16} />}
          </button>

          <p className="text-center text-xs text-gray-500 mt-1">
            Already registered?{" "}
            <button type="button" onClick={onSwitchToLogin} className="text-orange-600 font-semibold hover:underline cursor-pointer">
              Login
            </button>
          </p>
        </form>
      )}

      {/* ── STEP 2: OTP ──────────────────────────────────────────────────────── */}
      {step === "OTP" && (
        <form onSubmit={handleVerifyOtp} className="space-y-3">
          <div className="text-center mb-5">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-3 border border-orange-100">
              <Phone size={22} className="text-orange-500" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm">Verify Mobile</h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Enter the 6-digit OTP code sent to <strong className="text-gray-800">+91 {mobile}</strong>
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Enter 6-digit OTP
            </label>
            <input
              id="register-otp"
              type="text"
              inputMode="numeric"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
              maxLength={6}
              placeholder="••••••"
              autoComplete="one-time-code"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-lg font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all"
            />
          </div>

          <button
            id="register-verify-otp"
            type="submit"
            disabled={loading || otp.length !== 6}
            className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl text-sm hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-md shadow-orange-500/20 cursor-pointer"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            Verify OTP
          </button>

          <div className="flex flex-col items-center gap-1.5 mt-3">
            <button
              type="button"
              onClick={handleSendOtp}
              disabled={loading || otpCooldown > 0}
              className="text-xs text-orange-600 hover:text-orange-700 font-semibold disabled:text-gray-400 disabled:cursor-not-allowed cursor-pointer"
            >
              {otpCooldown > 0 ? `Resend OTP in ${otpCooldown}s` : "Resend OTP"}
            </button>

            <button
              type="button"
              onClick={() => { setStep("DETAILS"); setOtpSent(false); }}
              className="text-xs text-gray-500 hover:text-gray-700 font-medium hover:underline mt-1 cursor-pointer"
            >
              Change Mobile Number
            </button>
          </div>
        </form>
      )}

      {/* ── STEP 3: PIN ──────────────────────────────────────────────────────── */}
      {step === "PIN" && (
        <form onSubmit={handleSetPin} className="space-y-3">
          <div className="text-center mb-2">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-3 border border-orange-100">
              <KeyRound size={22} className="text-orange-500" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm">Create your PIN</h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              6-digit PIN you&apos;ll use to log in on any device
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">PIN *</label>
            <div className="relative">
              <input
                id="register-pin"
                type={showPin ? "text" : "password"}
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                maxLength={6}
                placeholder="••••••"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-lg font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all pr-10"
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

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Confirm PIN *
            </label>
            <input
              id="register-confirm-pin"
              type={showPin ? "text" : "password"}
              inputMode="numeric"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
              maxLength={6}
              placeholder="••••••"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-lg font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all"
            />
          </div>

          <p className="text-[10px] text-gray-400">
            Avoid simple PINs like 123456 or 000000.
          </p>

          <button
            id="register-set-pin"
            type="submit"
            disabled={loading || pin.length !== 6 || confirmPin.length !== 6}
            className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl text-sm hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-md shadow-orange-500/20 cursor-pointer"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            Complete Registration
          </button>
        </form>
      )}
    </div>
  );
}
