"use client";

import { useState, useRef, useEffect } from "react";
import { X, Phone, ShieldCheck, Loader2 } from "lucide-react";

interface OtpModalProps {
  state: "phone_input" | "otp_pending";
  onPhoneSubmit: (phone: string) => Promise<void>;
  onOtpVerify: (otp: string) => Promise<void>;
  otpSending: boolean;
  onClose: () => void;
}

export default function OtpModal({
  state,
  onPhoneSubmit,
  onOtpVerify,
  otpSending,
  onClose,
}: OtpModalProps) {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset OTP inputs when moving to otp_pending state
  useEffect(() => {
    if (state === "otp_pending") {
      setOtp(["", "", "", "", "", ""]);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    }
  }, [state]);

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (phone.replace(/\D/g, "").length !== 10) return;
    setSubmitting(true);
    try {
      await onPhoneSubmit(phone);
    } finally {
      setSubmitting(false);
    }
  }

  function handleOtpDigit(index: number, value: string) {
    if (!/^\d?$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      e.preventDefault();
      setOtp(pasted.split(""));
      otpRefs.current[5]?.focus();
    }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = otp.join("");
    if (code.length !== 6) return;
    setSubmitting(true);
    try {
      await onOtpVerify(code);
    } finally {
      setSubmitting(false);
    }
  }

  // Auto-submit when all 6 digits are filled
  useEffect(() => {
    const code = otp.join("");
    if (code.length === 6 && !submitting && state === "otp_pending") {
      void handleOtpSubmit(new Event("submit") as unknown as React.FormEvent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Bottom-sheet modal */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col max-h-[90vh] bg-white rounded-t-3xl shadow-2xl max-w-lg mx-auto animate-in slide-in-from-bottom duration-300">
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="p-6 pb-10 overflow-y-auto">
          {state === "phone_input" ? (
            <form onSubmit={handlePhoneSubmit} className="space-y-5">
              <div className="text-center space-y-1">
                <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Phone className="text-orange-600" size={26} />
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  Verify Your Number
                </h2>
                <p className="text-sm text-gray-500">
                  Enter your registered mobile number to place an order
                </p>
              </div>

              <div className="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden focus-within:border-orange-500 transition-colors">
                <span className="px-3 py-3.5 bg-gray-50 text-gray-500 font-medium text-sm border-r border-gray-200 flex-shrink-0">
                  +91
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  maxLength={10}
                  value={phone}
                  onChange={(e) =>
                    setPhone(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="10-digit mobile number"
                  className="flex-1 px-3 py-3.5 text-base font-medium text-gray-900 outline-none bg-white"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={phone.length !== 10 || submitting || otpSending}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {(submitting || otpSending) && (
                  <Loader2 size={18} className="animate-spin" />
                )}
                {submitting || otpSending ? "Sending OTP…" : "Send OTP"}
              </button>

              <p className="text-center text-xs text-gray-400">
                Not registered?{" "}
                <a
                  href={`https://wa.me/${process.env.NEXT_PUBLIC_ADMIN_WHATSAPP ?? "916356350086"}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-500 underline"
                >
                  Contact admin on WhatsApp
                </a>
              </p>
            </form>
          ) : (
            <form onSubmit={handleOtpSubmit} className="space-y-5">
              <div className="text-center space-y-1">
                <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <ShieldCheck className="text-green-600" size={26} />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Enter OTP</h2>
                <p className="text-sm text-gray-500">
                  We&apos;ve sent a 6-digit code to{" "}
                  <strong>+91 {phone}</strong>
                </p>
              </div>

              {/* 6-digit OTP input boxes */}
              <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      otpRefs.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpDigit(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="w-12 h-14 text-center text-xl font-bold border-2 rounded-xl outline-none border-gray-200 focus:border-orange-500 transition-colors text-gray-900"
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={otp.join("").length !== 6 || submitting}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 size={18} className="animate-spin" />}
                {submitting ? "Verifying…" : "Verify OTP"}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
