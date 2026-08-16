// src/app/(customer)/menu/profile/page.tsx

"use client";

import { useEffect, useState } from "react";
import {
  User as UserIcon, Phone, Building2, Home, Briefcase, MapPin, Plus, Pencil, Trash2,
  Star, Loader2, X, Check, AlertCircle, CalendarCheck, MessageSquare, ShoppingBag,
  ShieldCheck, ArrowRight, LogOut, ExternalLink, Wallet, CreditCard, ArrowDownRight,
  ArrowUpRight, CheckCircle2, Clock,
} from "lucide-react";
import { authedFetch } from "@/lib/customer-api-client";
import { toast } from "react-hot-toast";
import type { Address } from "@/components/customer/AddressSheet";
import Link from "next/link";
import { getWhatsAppInquiryLink } from "@/lib/constants";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MeResponse {
  id: string;
  name: string;
  number: string;
  workAddress: string | null;
  homeAddress: string | null;
  isVerified: boolean;
  verifiedAt: string | null;
  isActive: boolean;
  company: { id: string; name: string } | null;
}

interface CreditResponse {
  balance: number;
  creditLimit: number;
  remainingCredit: number;
  totalDebit: number;
  totalPaid: number;
  payments: Array<{
    id: string;
    amount: number;
    method: string;
    note: string | null;
    paidAtUtc: string;
  }>;
  timeline: Array<{
    type: "DEBIT" | "CREDIT";
    id: string;
    date: string;
    amount: number;
    label: string;
    status: string | null;
  }>;
}

type ProfileTab = "account" | "payments" | "addresses" | "quick_links";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatAddress(a: Address): string {
  const parts = [a.line1, a.line2, a.landmark].filter(Boolean);
  return parts.join(", ");
}

// ── Address Form (create or edit) ──────────────────────────────────────────────

interface AddressFormProps {
  initial?: Address | null; // present → edit mode (PATCH); absent → create mode (POST)
  defaultType?: "WORK" | "HOME";
  onSaved: (address: Address) => void;
  onCancel: () => void;
}

function AddressForm({ initial, defaultType = "HOME", onSaved, onCancel }: AddressFormProps) {
  const [type, setType] = useState<"WORK" | "HOME">(initial?.type ?? defaultType);
  const [line1, setLine1] = useState(initial?.line1 ?? "");
  const [line2, setLine2] = useState(initial?.line2 ?? "");
  const [landmark, setLandmark] = useState(initial?.landmark ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isEdit = !!initial;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (line1.trim().length < 5) {
      setError("Address line 1 must be at least 5 characters");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const url = isEdit ? `/api/customer/addresses/${initial!.id}` : "/api/customer/addresses";
      const method = isEdit ? "PATCH" : "POST";
      const res = await authedFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          line1: line1.trim(),
          line2: line2.trim() || null,
          landmark: landmark.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save address");
        return;
      }
      onSaved(data.address);
      toast.success(isEdit ? "Address updated" : "Address added");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full px-3.5 py-2.5 sm:py-3 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all bg-white text-gray-800 placeholder-gray-400";

  return (
    <form onSubmit={handleSave} className="space-y-3 bg-orange-50/70 border border-orange-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs">
      <div className="flex items-center justify-between">
        <h4 className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase tracking-wider">
          {isEdit ? "Edit Address" : "Add New Address"}
        </h4>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(["WORK", "HOME"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              type === t
                ? "border-orange-500 bg-orange-500 text-white shadow-sm"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
            }`}
          >
            {t === "WORK" ? <Briefcase size={14} /> : <Home size={14} />}
            <span>{t === "WORK" ? "Work" : "Home"}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-medium">{error}</div>
      )}

      <input value={line1} onChange={(e) => setLine1(e.target.value)} placeholder="Address line 1 *" className={inputCls} required />
      <input value={line2} onChange={(e) => setLine2(e.target.value)} placeholder="Floor / Building / Suite (optional)" className={inputCls} />
      <input value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="Landmark (optional)" className={inputCls} />

      <div className="flex gap-2.5 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 sm:py-3 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || line1.trim().length < 5}
          className="flex-1 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs font-bold hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-orange-500/20"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {isEdit ? "Save Changes" : "Save Address"}
        </button>
      </div>
    </form>
  );
}

// ── Address Card ────────────────────────────────────────────────────────────────

function AddressCard({
  address,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  address: Address;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}) {
  return (
    <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-gray-200/80 bg-white shadow-xs hover:border-orange-200 transition-all space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="mt-0.5 p-2 sm:p-2.5 rounded-xl bg-orange-50 text-orange-600 shrink-0">
            {address.type === "WORK" ? (
              <Briefcase size={16} />
            ) : (
              <Home size={16} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-extrabold uppercase tracking-wide text-gray-700">
                {address.type === "WORK" ? "Work Location" : "Home Location"}
              </span>
              {address.isDefault && (
                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                  <Star size={10} className="fill-emerald-600 text-emerald-600" /> Default
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-gray-800 font-medium leading-relaxed break-words">{formatAddress(address)}</p>
          </div>
        </div>
      </div>
      
      <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-gray-100">
        {!address.isDefault && (
          <button
            onClick={onSetDefault}
            className="text-xs font-semibold text-gray-500 hover:text-orange-600 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-orange-50 cursor-pointer"
          >
            Set as Default
          </button>
        )}
        <button
          onClick={onEdit}
          className="text-xs font-semibold text-gray-600 hover:text-orange-600 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-orange-50 flex items-center gap-1 cursor-pointer"
        >
          <Pencil size={13} /> Edit
        </button>
        <button
          onClick={onDelete}
          className="text-xs font-semibold text-gray-400 hover:text-red-600 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-red-50 flex items-center gap-1 ml-auto cursor-pointer"
        >
          <Trash2 size={13} /> Delete
        </button>
      </div>
    </div>
  );
}

// ── Main Profile Page ────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [credit, setCredit] = useState<CreditResponse | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [maxLimit, setMaxLimit] = useState<number>(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<ProfileTab>("account");

  const [showAddForm, setShowAddForm] = useState(false);
  const [addFormType, setAddFormType] = useState<"WORK" | "HOME">("HOME");
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [meRes, addrRes, creditRes] = await Promise.all([
        authedFetch("/api/customer/me"),
        authedFetch("/api/customer/addresses"),
        authedFetch("/api/customer/credit"),
      ]);
      if (!meRes.ok) {
        setError("Could not load your profile. Please try again.");
        return;
      }
      const meData = await meRes.json();
      const addrData = await addrRes.json();
      setMe(meData.user);
      setAddresses(addrData.addresses ?? []);
      if (addrData.maxLimit) setMaxLimit(addrData.maxLimit);

      if (creditRes.ok) {
        const creditData = await creditRes.json();
        setCredit(creditData);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddressSaved = (addr: Address) => {
    setAddresses((prev) => {
      const idx = prev.findIndex((a) => a.id === addr.id);
      let next: Address[];
      if (idx >= 0) {
        next = [...prev];
        next[idx] = addr;
      } else {
        next = [...prev, addr];
      }
      if (addr.isDefault) {
        next = next.map((a) => (a.id !== addr.id && a.type === addr.type ? { ...a, isDefault: false } : a));
      }
      return next;
    });
    setShowAddForm(false);
    setEditingAddress(null);
  };

  const handleSetDefault = async (addr: Address) => {
    try {
      const res = await authedFetch(`/api/customer/addresses/${addr.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to set default");
        return;
      }
      handleAddressSaved(data.address);
    } catch {
      toast.error("Network error. Please try again.");
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await authedFetch(`/api/customer/addresses/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to delete address");
        return;
      }
      setAddresses((prev) => prev.filter((a) => a.id !== id));
      toast.success("Address deleted");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const workAddresses = addresses.filter((a) => a.type === "WORK");
  const homeAddresses = addresses.filter((a) => a.type === "HOME");

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-orange-500" />
      </div>
    );
  }

  if (error || !me) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 p-6 sm:p-8 text-center">
        <AlertCircle size={36} className="text-red-400" />
        <p className="text-sm text-gray-600">{error || "Could not load your profile."}</p>
        <button onClick={loadAll} className="text-xs font-bold text-orange-600 hover:underline cursor-pointer">
          Try Again
        </button>
      </div>
    );
  }

  const whatsappMsg = `Hello ViTa Cuisine Admin, I need assistance regarding my user account details (Name: ${me.name}, Mobile: ${me.number}).`;
  const whatsappLink = getWhatsAppInquiryLink(whatsappMsg);

  const payoffMsg = `Hello ViTa Cuisine Admin, I would like to pay off my current outstanding balance of ₹${(credit?.balance ?? 0).toFixed(2)} for account ${me.name} (${me.number}). Please guide me with payment options.`;
  const payoffWhatsAppLink = getWhatsAppInquiryLink(payoffMsg);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5 sm:space-y-6 pb-28">
      {/* User Header Card */}
      <div className="bg-gradient-to-br from-orange-500 via-orange-600 to-amber-600 rounded-3xl p-5 sm:p-7 text-white shadow-lg shadow-orange-500/15">
        <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-5">
          <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white text-2xl sm:text-3xl font-black border border-white/30 shrink-0 shadow-inner">
            {me.name.charAt(0).toUpperCase()}
          </div>
          <div className="space-y-1.5 flex-1 min-w-0 w-full">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white truncate">{me.name}</h1>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs text-orange-100 font-medium">
              <span className="flex items-center gap-1 bg-black/10 px-2.5 py-1 rounded-xl font-semibold">
                <Phone size={12} /> +91 {me.number}
              </span>
              <span className="bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-xl font-extrabold text-[11px] text-white">
                {me.company ? me.company.name : "Home Orders Only"}
              </span>
              {credit && credit.balance > 0 && (
                <span className="bg-red-500 text-white font-extrabold px-2.5 py-1 rounded-xl text-[11px] flex items-center gap-1 shadow-sm">
                  <AlertCircle size={12} /> ₹{credit.balance.toFixed(2)} Due
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Control Bar — Responsive Grid on Mobile */}
      <div className="grid grid-cols-4 bg-gray-100/90 p-1.5 rounded-2xl gap-1 border border-gray-200/80 shadow-xs">
        <button
          type="button"
          onClick={() => setActiveTab("account")}
          className={`flex items-center justify-center gap-1 sm:gap-2 py-2.5 px-1.5 sm:px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
            activeTab === "account"
              ? "bg-white text-orange-600 shadow-sm"
              : "text-gray-500 hover:text-gray-800"
          }`}
        >
          <UserIcon size={16} className="shrink-0" />
          <span className="truncate">Account</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("payments")}
          className={`flex items-center justify-center gap-1 sm:gap-2 py-2.5 px-1.5 sm:px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
            activeTab === "payments"
              ? "bg-white text-orange-600 shadow-sm"
              : "text-gray-500 hover:text-gray-800"
          }`}
        >
          <Wallet size={16} className="shrink-0 text-amber-500" />
          <span className="truncate">Payments</span>
          {credit && credit.balance > 0 && (
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 animate-pulse" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("addresses")}
          className={`flex items-center justify-center gap-1 sm:gap-2 py-2.5 px-1.5 sm:px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
            activeTab === "addresses"
              ? "bg-white text-orange-600 shadow-sm"
              : "text-gray-500 hover:text-gray-800"
          }`}
        >
          <MapPin size={16} className="shrink-0" />
          <span className="truncate">Addresses</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("quick_links")}
          className={`flex items-center justify-center gap-1 sm:gap-2 py-2.5 px-1.5 sm:px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
            activeTab === "quick_links"
              ? "bg-white text-orange-600 shadow-sm"
              : "text-gray-500 hover:text-gray-800"
          }`}
        >
          <ShieldCheck size={16} className="shrink-0" />
          <span className="truncate">Shortcuts</span>
        </button>
      </div>

      {/* ── TAB 1: ACCOUNT DETAILS ──────────────────────────────────────────── */}
      {activeTab === "account" && (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 sm:p-7 space-y-6 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
            <div>
              <h2 className="font-extrabold text-gray-900 text-base sm:text-lg flex items-center gap-2">
                <UserIcon size={20} className="text-orange-500" /> Personal Account Details
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">Your registered user profile details</p>
            </div>
            <span className="self-start sm:self-center text-[11px] font-extrabold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
              ✓ Verified Customer
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            <div className="bg-gray-50/90 rounded-2xl p-4 space-y-1 border border-gray-100">
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-wider flex items-center gap-1.5">
                <UserIcon size={13} className="text-orange-500" /> Full Name
              </p>
              <p className="text-sm sm:text-base text-gray-900 font-bold break-words">{me.name}</p>
            </div>

            <div className="bg-gray-50/90 rounded-2xl p-4 space-y-1 border border-gray-100">
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-wider flex items-center gap-1.5">
                <Phone size={13} className="text-orange-500" /> Registered Mobile Number
              </p>
              <p className="text-sm sm:text-base text-gray-900 font-bold">+91 {me.number}</p>
            </div>

            <div className="bg-gray-50/90 rounded-2xl p-4 space-y-1 border border-gray-100">
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-wider flex items-center gap-1.5">
                <Building2 size={13} className="text-orange-500" /> Workplace / Organization
              </p>
              <p className="text-sm sm:text-base text-gray-900 font-bold break-words">
                {me.company ? me.company.name : "Not linked (Home Orders Only)"}
              </p>
            </div>

            {me.verifiedAt && (
              <div className="bg-gray-50/90 rounded-2xl p-4 space-y-1 border border-gray-100">
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-wider flex items-center gap-1.5">
                  <CalendarCheck size={13} className="text-orange-500" /> Member Since
                </p>
                <p className="text-sm sm:text-base text-gray-900 font-bold">
                  {new Date(me.verifiedAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            )}
          </div>

          <div className="bg-amber-50/90 border border-amber-200/80 rounded-2xl p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <MessageSquare size={18} className="text-amber-600 mt-0.5 shrink-0" />
              <div className="space-y-1.5 flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-bold text-amber-950">Need to update your identity details?</p>
                <p className="text-xs text-amber-800/90 leading-relaxed">
                  For account safety and delivery validation, changes to your name, mobile number, or workplace are managed by administration.
                </p>
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-700 hover:text-emerald-800 mt-1.5 bg-emerald-100/60 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200 transition-colors cursor-pointer"
                >
                  Contact Admin on WhatsApp <ExternalLink size={13} />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: PAYMENTS & CREDIT DEBIT ──────────────────────────────────── */}
      {activeTab === "payments" && credit && (
        <div className="space-y-5 animate-fadeIn">
          {/* Main Due Balance Card */}
          <div className="bg-white rounded-3xl border border-gray-200 p-5 sm:p-7 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
              <div>
                <p className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Wallet size={15} className="text-amber-500" /> Current Outstanding Payoff Balance
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className={`text-3xl sm:text-4xl font-black ${credit.balance > 0 ? "text-red-600" : "text-emerald-600"}`}>
                    ₹{credit.balance.toFixed(2)}
                  </span>
                  <span className="text-xs text-gray-400 font-semibold">Total Due</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {credit.balance > 0 ? (
                  <a
                    href={payoffWhatsAppLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-extrabold text-xs sm:text-sm px-5 py-3 rounded-2xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    💬 Pay Off Balance with Admin <ExternalLink size={14} />
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 font-extrabold text-xs px-4 py-2.5 rounded-2xl">
                    <CheckCircle2 size={16} /> Account Completely Clear
                  </span>
                )}
              </div>
            </div>

            {/* Credit Limit Meter */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-gray-600 flex items-center gap-1.5">
                  <CreditCard size={14} className="text-orange-500" /> Approved Credit Limit
                </span>
                <span className="text-gray-900 font-black">
                  ₹{credit.balance.toFixed(2)} / ₹{credit.creditLimit.toFixed(2)}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden p-0.5 border border-gray-200/60">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    credit.balance >= credit.creditLimit
                      ? "bg-red-500"
                      : credit.balance > credit.creditLimit * 0.75
                      ? "bg-amber-500"
                      : "bg-gradient-to-r from-orange-500 to-amber-500"
                  }`}
                  style={{
                    width: `${Math.min(100, Math.max(0, (credit.balance / credit.creditLimit) * 100))}%`,
                  }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-gray-500 font-medium pt-0.5">
                <span>Remaining Available Credit: <strong className="text-gray-900 font-bold">₹{credit.remainingCredit.toFixed(2)}</strong></span>
                <span>{((credit.balance / credit.creditLimit) * 100).toFixed(0)}% Used</span>
              </div>
            </div>

            {/* Stats Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              <div className="bg-orange-50/70 border border-orange-100 rounded-2xl p-4 space-y-1">
                <p className="text-[10px] text-orange-700 font-black uppercase tracking-wider">Total Debit (Orders)</p>
                <p className="text-base sm:text-lg font-black text-gray-900">₹{credit.totalDebit.toFixed(2)}</p>
              </div>

              <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-4 space-y-1">
                <p className="text-[10px] text-emerald-700 font-black uppercase tracking-wider">Total Paid (Credits)</p>
                <p className="text-base sm:text-lg font-black text-gray-900">₹{credit.totalPaid.toFixed(2)}</p>
              </div>

              <div className="col-span-2 sm:col-span-1 bg-gray-50 border border-gray-200/80 rounded-2xl p-4 space-y-1">
                <p className="text-[10px] text-gray-500 font-black uppercase tracking-wider">Credit Limit</p>
                <p className="text-base sm:text-lg font-black text-gray-900">₹{credit.creditLimit.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Statement & Payment History Timeline */}
          <div className="bg-white rounded-3xl border border-gray-200 p-5 sm:p-7 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-extrabold text-gray-900 text-sm sm:text-base flex items-center gap-2">
                <Clock size={18} className="text-orange-500" /> Statement &amp; Payment History
              </h3>
              <span className="text-xs text-gray-400 font-semibold">{credit.timeline.length} transactions</span>
            </div>

            {credit.timeline.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-400">
                No orders or payments recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {credit.timeline.map((item) => (
                  <div key={item.id} className="py-3.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                          item.type === "DEBIT"
                            ? "bg-red-50 text-red-600"
                            : "bg-emerald-50 text-emerald-600"
                        }`}
                      >
                        {item.type === "DEBIT" ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 truncate">{item.label}</p>
                        <p className="text-[11px] text-gray-400 font-medium">
                          {new Date(item.date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p
                        className={`font-black text-sm ${
                          item.type === "DEBIT" ? "text-gray-900" : "text-emerald-600"
                        }`}
                      >
                        {item.type === "DEBIT" ? "+" : "-"}₹{item.amount.toFixed(2)}
                      </p>
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md inline-block uppercase ${
                          item.type === "DEBIT"
                            ? "bg-gray-100 text-gray-600"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}
                      >
                        {item.type === "DEBIT" ? (item.status ?? "Order") : "Payment Received"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 3: ADDRESSES ────────────────────────────────────────────────── */}
      {activeTab === "addresses" && (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 sm:p-7 space-y-5 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
            <div>
              <h2 className="font-extrabold text-gray-900 text-base sm:text-lg flex items-center gap-2">
                <MapPin size={20} className="text-orange-500" /> Delivery Addresses ({addresses.length}/{maxLimit})
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">Manage your saved workplace and residential addresses</p>
            </div>
            {!showAddForm && !editingAddress && (
              addresses.length >= maxLimit ? (
                <div className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-800 shrink-0 self-start sm:self-center">
                  Address limit reached ({addresses.length}/{maxLimit})
                </div>
              ) : (
                <button
                  onClick={() => {
                    setAddFormType("HOME");
                    setShowAddForm(true);
                  }}
                  className="flex items-center justify-center gap-1.5 text-xs font-extrabold text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 px-4 py-2.5 rounded-xl shadow-md shadow-orange-500/20 transition-all cursor-pointer shrink-0 self-start sm:self-center"
                >
                  <Plus size={15} /> Add New Address
                </button>
              )
            )}
          </div>

          {addresses.length >= maxLimit && !editingAddress && !showAddForm && (
            <div className="p-4 bg-amber-50 border border-amber-200/90 rounded-2xl flex items-start gap-3">
              <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 leading-relaxed">
                <p className="font-bold text-sm">Maximum Address Limit Reached ({addresses.length}/{maxLimit})</p>
                <p className="text-amber-800 mt-1">
                  You have saved the maximum limit of <strong>{maxLimit} addresses</strong> allowed for your account. To add a new delivery location, please delete an existing address below.
                </p>
              </div>
            </div>
          )}

          {showAddForm && (
            <AddressForm defaultType={addFormType} onSaved={handleAddressSaved} onCancel={() => setShowAddForm(false)} />
          )}
          {editingAddress && (
            <AddressForm initial={editingAddress} onSaved={handleAddressSaved} onCancel={() => setEditingAddress(null)} />
          )}

          {addresses.length === 0 && !showAddForm ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-orange-50 text-orange-400 flex items-center justify-center mx-auto">
                <MapPin size={32} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-gray-800">No delivery addresses saved yet</p>
                <p className="text-xs text-gray-400 max-w-xs mx-auto">Save your office or home location for fast meal checkout.</p>
              </div>
              <button
                onClick={() => {
                  setAddFormType("HOME");
                  setShowAddForm(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-md shadow-orange-500/20"
              >
                <Plus size={15} /> Add Address Now
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {workAddresses.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Briefcase size={14} className="text-orange-500" /> Work Addresses ({workAddresses.length})
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    {workAddresses.map((addr) => (
                      <AddressCard
                        key={addr.id}
                        address={addr}
                        onEdit={() => {
                          setShowAddForm(false);
                          setEditingAddress(addr);
                        }}
                        onDelete={() => setConfirmDeleteId(addr.id)}
                        onSetDefault={() => handleSetDefault(addr)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {homeAddresses.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Home size={14} className="text-orange-500" /> Home Addresses ({homeAddresses.length})
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    {homeAddresses.map((addr) => (
                      <AddressCard
                        key={addr.id}
                        address={addr}
                        onEdit={() => {
                          setShowAddForm(false);
                          setEditingAddress(addr);
                        }}
                        onDelete={() => setConfirmDeleteId(addr.id)}
                        onSetDefault={() => handleSetDefault(addr)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: SHORTCUTS ────────────────────────────────────────────────── */}
      {activeTab === "quick_links" && (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 sm:p-7 space-y-5 animate-fadeIn">
          <div className="border-b border-gray-100 pb-3">
            <h2 className="font-extrabold text-gray-900 text-base sm:text-lg flex items-center gap-2">
              <ShieldCheck size={20} className="text-orange-500" /> Quick Account Actions
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Shortcuts for ordering, history &amp; support</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-1">
            <Link
              href="/menu/orders"
              className="p-4 sm:p-5 rounded-2xl border border-gray-200/90 hover:border-orange-400 hover:bg-orange-50/40 transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="p-3 rounded-xl bg-orange-50 text-orange-600 group-hover:bg-orange-500 group-hover:text-white transition-colors shrink-0">
                  <ShoppingBag size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-gray-900 truncate">My Orders</p>
                  <p className="text-xs text-gray-400 truncate">Check past &amp; active thali orders</p>
                </div>
              </div>
              <ArrowRight size={16} className="text-gray-300 group-hover:text-orange-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
            </Link>

            <Link
              href="/menu"
              className="p-4 sm:p-5 rounded-2xl border border-gray-200/90 hover:border-orange-400 hover:bg-orange-50/40 transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="p-3 rounded-xl bg-orange-50 text-orange-600 group-hover:bg-orange-500 group-hover:text-white transition-colors shrink-0">
                  <Home size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-gray-900 truncate">Today&apos;s Menu</p>
                  <p className="text-xs text-gray-400 truncate">Browse &amp; order meal packages</p>
                </div>
              </div>
              <ArrowRight size={16} className="text-gray-300 group-hover:text-orange-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
            </Link>

            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 sm:p-5 rounded-2xl border border-emerald-200/90 hover:border-emerald-400 hover:bg-emerald-50/40 transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0">
                  <MessageSquare size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-gray-900 truncate">WhatsApp Support</p>
                  <p className="text-xs text-gray-400 truncate">Direct help &amp; bulk order inquiry</p>
                </div>
              </div>
              <ArrowRight size={16} className="text-gray-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
            </a>

            <button
              type="button"
              onClick={async () => {
                await fetch("/api/customer/logout", { method: "POST" });
                window.location.href = "/menu";
              }}
              className="p-4 sm:p-5 rounded-2xl border border-red-100 hover:border-red-300 hover:bg-red-50/40 transition-all flex items-center justify-between group cursor-pointer text-left"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="p-3 rounded-xl bg-red-50 text-red-500 group-hover:bg-red-500 group-hover:text-white transition-colors shrink-0">
                  <LogOut size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-red-600 truncate">Sign Out</p>
                  <p className="text-xs text-gray-400 truncate">Safely log out of your session</p>
                </div>
              </div>
              <ArrowRight size={16} className="text-gray-300 group-hover:text-red-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !deletingId && setConfirmDeleteId(null)} />
          <div className="relative z-10 w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-gray-100 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-extrabold text-gray-900">Delete Address?</h3>
              <p className="text-xs text-gray-500">This address will be permanently removed from your account.</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                disabled={!!deletingId}
                className="flex-1 py-2.5 border border-gray-200 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={!!deletingId}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-red-500/20 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {deletingId ? <Loader2 size={14} className="animate-spin" /> : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
