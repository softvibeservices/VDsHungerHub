"use client";

import { useState, useEffect } from "react";
import { ChevronRight, Loader2, Building2, Plus, Phone, KeyRound, Eye, EyeOff } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = "DETAILS" | "OTP" | "PIN";

interface Company {
  id: string;
  name: string;
}

interface Props {
  onSuccess: () => void;
  onSwitchToLogin: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getDeviceVisitorId(): Promise<string> {
  const raw = [
    navigator.userAgent,
    screen.width.toString(),
    screen.height.toString(),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.hardwareConcurrency?.toString() ?? "",
  ].join("|");

  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RegisterForm({ onSuccess, onSwitchToLogin }: Props) {
  const [step, setStep] = useState<Step>("DETAILS");

  // Step 1 state
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [workAddress, setWorkAddress] = useState("");
  const [homeAddress, setHomeAddress] = useState("");
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

  // ── Step 1: Submit details ──────────────────────────────────────────────────
  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Client-side validations
    if (!fullName.trim() || fullName.trim().length < 2 || fullName.trim().length > 80) {
      setError("Full name must be between 2 and 80 characters.");
      return;
    }

    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(mobile)) {
      setError("Please enter a valid 10-digit Indian mobile number.");
      return;
    }

    if (!workAddress.trim() || workAddress.trim().length < 10 || workAddress.trim().length > 300) {
      setError("Work / Delivery Address must be between 10 and 300 characters.");
      return;
    }

    if (homeAddress.trim() && (homeAddress.trim().length < 10 || homeAddress.trim().length > 300)) {
      setError("Home Address must be between 10 and 300 characters if provided.");
      return;
    }

    if (!newCompany && !companyId) {
      setError("Please select a company.");
      return;
    }

    if (newCompany && (!newCompanyName.trim() || newCompanyName.trim().length < 2 || newCompanyName.trim().length > 100)) {
      setError("Company name must be between 2 and 100 characters.");
      return;
    }

    setLoading(true);

    try {
      const visitorId = await getDeviceVisitorId();

      // 1. Create the user draft
      const res = await fetch("/api/customer/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          workAddress,
          homeAddress: homeAddress || undefined,
          companyId: newCompany ? undefined : companyId,
          newCompanyName: newCompany ? newCompanyName : undefined,
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

      // 2. Immediately send OTP to the mobile number
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

    // Avoid simple PINs (consecutive or identical digits)
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
        body: JSON.stringify({ draftId, preAuthToken, pin }),
      });

      const data = await res.json();

      if (!res.ok) {
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

  return (
    <div>
      {/* Step indicator */}
      <div className="flex items-center mb-6">
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
        <form onSubmit={handleDetailsSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
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
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
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
                className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Work / Delivery Address *
            </label>
            <textarea
              id="register-work-address"
              value={workAddress}
              onChange={(e) => setWorkAddress(e.target.value)}
              required
              minLength={10}
              maxLength={300}
              rows={2}
              placeholder="Office / delivery location"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Home Address <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="register-home-address"
              value={homeAddress}
              onChange={(e) => setHomeAddress(e.target.value)}
              maxLength={300}
              rows={2}
              placeholder="Residential address"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Building2 size={13} /> Company *
            </label>

            {!newCompany ? (
              <div className="flex gap-2">
                <select
                  id="register-company-select"
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-white transition-all"
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
                  onClick={() => setNewCompany(true)}
                  className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-semibold px-2 py-2 border border-orange-200 rounded-xl hover:bg-orange-50 transition-colors"
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
                  className="flex-1 px-3.5 py-2.5 border border-orange-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => { setNewCompany(false); setNewCompanyName(""); }}
                  className="text-xs text-gray-500 hover:text-gray-700 px-2 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}

            {!newCompany && !companyId && (
              <p className="text-xs text-gray-400 mt-1">
                Don&apos;t see your company? Click &quot;New&quot; to add it.
              </p>
            )}
          </div>

          <button
            id="register-step1-submit"
            type="submit"
            disabled={
              loading ||
              !fullName.trim() ||
              mobile.length !== 10 ||
              !workAddress.trim() ||
              (!newCompany && !companyId) ||
              (newCompany && !newCompanyName.trim())
            }
            className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl text-sm hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-md shadow-orange-500/20 mt-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            Continue
            {!loading && <ChevronRight size={16} />}
          </button>

          <p className="text-center text-xs text-gray-500">
            Already registered?{" "}
            <button type="button" onClick={onSwitchToLogin} className="text-orange-600 font-semibold hover:underline">
              Login
            </button>
          </p>
        </form>
      )}

      {/* ── STEP 2: OTP ──────────────────────────────────────────────────────── */}
      {step === "OTP" && (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-3 border border-orange-100">
              <Phone size={22} className="text-orange-500" />
            </div>
            <h3 className="font-bold text-gray-900">Verify Mobile</h3>
            <p className="text-xs text-gray-500 mt-1">
              Enter the 6-digit OTP code sent to <strong className="text-gray-800">+91 {mobile}</strong>
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
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
              className="w-full px-3.5 py-3 border border-gray-200 rounded-xl text-lg font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all"
            />
          </div>

          <button
            id="register-verify-otp"
            type="submit"
            disabled={loading || otp.length !== 6}
            className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl text-sm hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-md shadow-orange-500/20"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            Verify OTP
          </button>

          <div className="flex flex-col items-center gap-2 mt-4">
            <button
              type="button"
              onClick={handleSendOtp}
              disabled={loading || otpCooldown > 0}
              className="text-xs text-orange-600 hover:text-orange-700 font-semibold disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              {otpCooldown > 0 ? `Resend OTP in ${otpCooldown}s` : "Resend OTP"}
            </button>

            <button
              type="button"
              onClick={() => { setStep("DETAILS"); setOtpSent(false); }}
              className="text-xs text-gray-500 hover:text-gray-700 font-medium hover:underline mt-1"
            >
              Change Mobile Number
            </button>
          </div>
        </form>
      )}

      {/* ── STEP 3: PIN ──────────────────────────────────────────────────────── */}
      {step === "PIN" && (
        <form onSubmit={handleSetPin} className="space-y-4">
          <div className="text-center mb-2">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-3 border border-orange-100">
              <KeyRound size={22} className="text-orange-500" />
            </div>
            <h3 className="font-bold text-gray-900">Create your PIN</h3>
            <p className="text-xs text-gray-500 mt-1">
              6-digit PIN you&apos;ll use to log in on any device
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">PIN *</label>
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
                className="w-full px-3.5 py-3 border border-gray-200 rounded-xl text-lg font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPin((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
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
              className="w-full px-3.5 py-3 border border-gray-200 rounded-xl text-lg font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all"
            />
          </div>

          <p className="text-xs text-gray-400">
            Avoid simple PINs like 123456 or 000000.
          </p>

          <button
            id="register-set-pin"
            type="submit"
            disabled={loading || pin.length !== 6 || confirmPin.length !== 6}
            className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl text-sm hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-md shadow-orange-500/20"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            Complete Registration
          </button>
        </form>
      )}
    </div>
  );
}
