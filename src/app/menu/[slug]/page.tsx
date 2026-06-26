"use client";

import { useEffect, useState, useRef, use } from "react";
import {
  UtensilsCrossed,
  Clock,
  AlertCircle,
  CheckCircle,
  Lock,
  Plus,
  Minus,
  PackagePlus,
  CheckCircle2,
} from "lucide-react";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase-client";
import { getDeviceHash } from "@/lib/user-auth";
import { formatCurrency } from "@/lib/utils";
import { formatTimeIST } from "@/lib/time";
import { toast } from "react-hot-toast";
import OtpModal from "@/components/public/OtpModal";
import OrderConfirmModal from "@/components/public/OrderConfirmModal";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ThaliItem {
  id: string;
  itemName: string;
}

interface Product {
  id: string;
  name: string;
  nameGu?: string | null;
  price: number;
}

interface ThaliCategory {
  id: string;
  name: string;
  nameGu?: string | null;
}

interface Thali {
  id: string;
  name: string;
  nameGu?: string | null;
  price: number;
  sabjiCount: number;
  categoryId: string | null;
  category?: ThaliCategory | null;
  items: ThaliItem[];
}

interface DailyMenuThali {
  id: string;
  thaliId: string;
  thali: Thali;
  minSabjiRequired: number;
}

interface DailyMenuSabjiOption {
  id: string;
  categoryId: string;
  productId: string;
  product: Product;
}

interface DailyMenu {
  id: string;
  publicSlug: string;
  date: string;
  mealType: "LUNCH" | "DINNER";
  cutoffTime?: string | null;
  thalis: DailyMenuThali[];
  sabjiOptions: DailyMenuSabjiOption[];
}

interface UserInfo {
  id: string;
  name: string;
  number: string;
  companyName: string;
}

type PageState =
  | "loading"
  | "not_found"
  | "cutoff_passed"
  | "menu"
  | "phone_input"
  | "otp_pending"
  | "confirming"
  | "success";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LOCAL_JWT_KEY = "vdh_user_jwt";

function getStoredJwt(): string | null {
  try {
    return localStorage.getItem(LOCAL_JWT_KEY);
  } catch {
    return null;
  }
}

function storeJwt(token: string) {
  try {
    localStorage.setItem(LOCAL_JWT_KEY, token);
  } catch {
    /* ignore in SSR or private browsing */
  }
}

function isCutoffPassed(cutoffTime: string | null | undefined): boolean {
  if (!cutoffTime) return false;
  return new Date() > new Date(cutoffTime);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PublicMenuPage({ params }: PageProps) {
  const { slug } = use(params);

  // Core state
  const [pageState, setPageState] = useState<PageState>("loading");
  const [menu, setMenu] = useState<DailyMenu | null>(null);
  const [addOns, setAddOns] = useState<Product[]>([]);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  // Selections
  const [selectedThaliId, setSelectedThaliId] = useState<string>("");
  const [selectedSabjis, setSelectedSabjis] = useState<Record<string, string[]>>({}); // thaliId -> productIds
  const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>({}); // productId -> quantity

  // OTP state
  const [otpSending, setOtpSending] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  // Order state
  const [placingOrder, setPlacingOrder] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState<string>("");

  // ─── Init: fetch menu + check auth ────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const res = await fetch(`/api/public/menu/${slug}`);
      if (!res.ok) {
        setPageState("not_found");
        return;
      }
      const data = await res.json();
      const menuData: DailyMenu = data.menu;
      const addOnsData: Product[] = data.addOns ?? [];

      setMenu(menuData);
      setAddOns(addOnsData);

      if (menuData.thalis.length > 0) {
        setSelectedThaliId(menuData.thalis[0].thali.id);
      }

      // Check cutoff (client-side display only; server enforces it too)
      if (isCutoffPassed(menuData.cutoffTime)) {
        setPageState("cutoff_passed");
        return;
      }

      // Check stored JWT
      const jwt = getStoredJwt();
      if (jwt) {
        const deviceHash = await getDeviceHash();
        const meRes = await fetch(`/api/user-auth/me?deviceHash=${deviceHash}`, {
          headers: { Authorization: `Bearer ${jwt}` },
        });
        if (meRes.ok) {
          const me = await meRes.json();
          if (!me.newDevice) {
            setUserInfo(me);
          }
        } else {
          // JWT invalid — clear it
          localStorage.removeItem(LOCAL_JWT_KEY);
        }
      }

      setPageState("menu");
    }

    init().catch(console.error);
  }, [slug]);

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const selectedMenuThali = menu?.thalis.find(
    (mt) => mt.thali.id === selectedThaliId
  );

  const toggleSabji = (thaliId: string, productId: string, maxCount: number) => {
    const current = selectedSabjis[thaliId] ?? [];
    if (current.includes(productId)) {
      setSelectedSabjis({ ...selectedSabjis, [thaliId]: current.filter((id) => id !== productId) });
    } else if (current.length < maxCount) {
      setSelectedSabjis({ ...selectedSabjis, [thaliId]: [...current, productId] });
    } else if (maxCount === 1) {
      setSelectedSabjis({ ...selectedSabjis, [thaliId]: [productId] });
    } else {
      toast.error(`You can select at most ${maxCount} sabji(s)`);
    }
  };

  const updateAddonQty = (addonId: string, delta: number) => {
    setSelectedAddons((prev) => {
      const currentQty = prev[addonId] ?? 0;
      const nextQty = Math.min(10, Math.max(0, currentQty + delta));
      const next = { ...prev };
      if (nextQty === 0) {
        delete next[addonId];
      } else {
        next[addonId] = nextQty;
      }
      return next;
    });
  };

  const validateSabjiSelection = () => {
    if (!selectedMenuThali) return false;
    const thali = selectedMenuThali.thali;
    if (thali.sabjiCount === 0) return true;
    const selected = (selectedSabjis[thali.id] ?? []).length;
    return selected === thali.sabjiCount;
  };

  const computeTotal = () => {
    const thaliPrice = selectedMenuThali?.thali.price ?? 0;
    const addonsTotal = Object.entries(selectedAddons)
      .map(([id, qty]) => (addOns.find((a) => a.id === id)?.price ?? 0) * qty)
      .reduce((a, b) => a + b, 0);
    return thaliPrice + addonsTotal;
  };

  // ─── Place order button handler ────────────────────────────────────────────
  async function handlePlaceOrder() {
    if (!selectedMenuThali) {
      toast.error("Please select a thali first");
      return;
    }
    if (!validateSabjiSelection()) {
      toast.error(
        `Please select exactly ${selectedMenuThali.thali.sabjiCount} sabji(s)`
      );
      return;
    }
    if (userInfo) {
      setPageState("confirming");
    } else {
      setPageState("phone_input");
    }
  }

  // ─── Phone number submit ───────────────────────────────────────────────────
  async function handlePhoneSubmit(phone: string) {
    const normalized = phone.replace(/\D/g, "").slice(-10);

    // Check if number is registered
    const checkRes = await fetch("/api/user-auth/check-number", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number: normalized }),
    });
    const checkData = await checkRes.json();

    if (!checkData.found) {
      const waNumber = process.env.NEXT_PUBLIC_ADMIN_WHATSAPP ?? "916356350086";
      const waMsg = encodeURIComponent(
        `Hi, I want to register for VD's Hunger Hub. My number is +91${normalized}`
      );
      window.open(`https://wa.me/${waNumber}?text=${waMsg}`, "_blank");
      toast("Your number is not registered. Opening WhatsApp for you!", {
        icon: "📱",
        duration: 5000,
      });
      setPageState("menu");
      return;
    }

    // Number is registered — trigger OTP via Firebase
    setOtpSending(true);
    try {
      if (!recaptchaVerifierRef.current && recaptchaContainerRef.current) {
        recaptchaVerifierRef.current = new RecaptchaVerifier(
          firebaseAuth,
          recaptchaContainerRef.current,
          { size: "invisible" }
        );
      }
      const result = await signInWithPhoneNumber(
        firebaseAuth,
        `+91${normalized}`,
        recaptchaVerifierRef.current!
      );
      setConfirmationResult(result);
      setPageState("otp_pending");
      toast.success("OTP sent to your number");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("too-many-requests")) {
        toast.error("Too many attempts. Please try again after a few minutes.");
      } else {
        toast.error("Could not send OTP. Please try again.");
      }
      setPageState("phone_input");
    } finally {
      setOtpSending(false);
    }
  }

  // ─── OTP verify ───────────────────────────────────────────────────────────
  async function handleOtpVerify(otp: string) {
    if (!confirmationResult) return;
    try {
      const credential = await confirmationResult.confirm(otp);
      const idToken = await credential.user.getIdToken();
      const deviceHash = await getDeviceHash();

      const verifyRes = await fetch("/api/user-auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, deviceHash }),
      });

      if (!verifyRes.ok) {
        const contentType = verifyRes.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const err = await verifyRes.json();
          toast.error(
            err.details
              ? `${err.error}: ${err.details}`
              : (err.error ?? "Verification failed")
          );
        } else {
          const rawText = await verifyRes.text();
          console.error("Non-JSON error response from verify endpoint:", rawText);
          toast.error(`Server error (${verifyRes.status}): Please check backend configuration/logs.`);
        }
        return;
      }

      const contentType = verifyRes.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const rawText = await verifyRes.text();
        console.error("Unexpected non-JSON success response:", rawText);
        toast.error("Invalid response format from server.");
        return;
      }

      const { token, user } = await verifyRes.json();
      storeJwt(token);
      setUserInfo(user);
      toast.success(`Welcome, ${user.name}!`);
      setPageState("confirming");
    } catch (err: any) {
      console.error("Firebase confirm OTP failed:", err);
      toast.error(err instanceof Error ? `Error: ${err.message}` : "Incorrect OTP. Please try again.");
    }
  }

  // ─── Confirm order ─────────────────────────────────────────────────────────
  async function handleConfirmOrder() {
    if (!menu || !selectedThaliId || !userInfo) return;
    setPlacingOrder(true);

    const jwt = getStoredJwt();
    try {
      const thaliId = selectedMenuThali?.thali.id ?? selectedThaliId;
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          menuId: menu.id,
          thaliId,
          selectedSabjiIds: selectedSabjis[thaliId] ?? [],
          selectedAddons: Object.entries(selectedAddons).map(([productId, quantity]) => ({
            productId,
            quantity,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Order failed");
        if (res.status === 409) {
          setPageState("menu"); // already ordered
        }
        return;
      }

      const data = await res.json();
      setPlacedOrderId(data.order.id);
      setPageState("success");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setPlacingOrder(false);
    }
  }

  // ─── Render states ─────────────────────────────────────────────────────────

  if (pageState === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500 font-medium">Loading today&apos;s menu…</p>
        </div>
      </div>
    );
  }

  if (pageState === "not_found" || !menu) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-sm space-y-4">
          <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto">
            <AlertCircle size={28} />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Menu Unavailable</h2>
          <p className="text-sm text-gray-500">
            This menu may have expired or hasn&apos;t been published yet. Please
            check back later.
          </p>
        </div>
      </div>
    );
  }

  if (pageState === "cutoff_passed") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-sm space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto">
            <Lock className="text-red-500" size={32} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Ordering Closed
            </h2>
            <p className="text-sm text-gray-500 mt-2">
              The cutoff time for today&apos;s menu has passed. Orders are no longer
              accepted for this meal.
            </p>
            {menu.cutoffTime && (
              <p className="text-xs text-red-500 font-semibold mt-2 flex items-center gap-1 justify-center">
                <Clock size={12} /> Cutoff was at {formatTimeIST(menu.cutoffTime)}
              </p>
            )}
          </div>
          <a
            href={`https://wa.me/${process.env.NEXT_PUBLIC_ADMIN_WHATSAPP ?? "916356350086"}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-green-500 hover:bg-green-600 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors"
          >
            Contact Admin on WhatsApp
          </a>
        </div>
      </div>
    );
  }

  if (pageState === "success") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-sm space-y-5">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <CheckCircle2 className="text-green-500" size={40} />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900">
              Order Placed! 🎉
            </h2>
            {userInfo && (
              <p className="text-sm text-gray-600 mt-1">
                Hello <strong>{userInfo.name}</strong>, your order has been received.
              </p>
            )}
            {placedOrderId && (
              <p className="text-xs text-gray-400 font-mono mt-1">
                Order #{placedOrderId.slice(-8).toUpperCase()}
              </p>
            )}
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800 font-medium">
            Your tiffin will be delivered at the usual time. No action required!
          </div>
          <button
            onClick={() => setPageState("menu")}
            className="text-sm text-orange-500 hover:text-orange-600 font-semibold"
          >
            ← Back to Menu
          </button>
        </div>
      </div>
    );
  }

  // ─── Main menu view ────────────────────────────────────────────────────────
  const isLunch = menu.mealType === "LUNCH";
  const dateStr = new Date(menu.date).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const cutoffExpired = isCutoffPassed(menu.cutoffTime);
  const canOrder = !cutoffExpired && validateSabjiSelection() && !!selectedMenuThali;

  return (
    <div className="min-h-screen bg-gray-50/50 pt-6 pb-24 px-4 sm:py-8 sm:px-4 md:px-6">
      {/* Invisible reCAPTCHA container — required by Firebase */}
      <div ref={recaptchaContainerRef} id="recaptcha-container" />

      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
          
          {/* Left Column: Selection controls */}
          <div className="md:col-span-2 space-y-4">
            
            {/* Combined Header Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-3">
                {/* Brand & Logo */}
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-md flex-shrink-0">
                    <UtensilsCrossed className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-base font-extrabold text-gray-900 leading-tight">
                      VD&apos;s Hunger Hub
                    </h1>
                    <p className="text-[10px] text-gray-500 font-semibold">
                      Fresh Tiffin, Delivered Daily
                    </p>
                  </div>
                </div>

                {/* Date & Meal Info */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-gray-800">{dateStr}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                      isLunch
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                    }`}
                  >
                    {isLunch ? "🌅 Lunch" : "🌙 Dinner"}
                  </span>
                  {menu.cutoffTime && (
                    <span
                      className={`flex items-center gap-1 font-bold text-[10px] ${
                        cutoffExpired ? "text-red-600" : "text-red-500"
                      }`}
                    >
                      <Clock size={11} />
                      Cutoff: {formatTimeIST(menu.cutoffTime)}
                    </span>
                  )}
                </div>
              </div>

              {/* User info if logged in */}
              {userInfo ? (
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>
                      Welcome, <strong className="text-gray-800">{userInfo.name}</strong> ({userInfo.companyName})
                    </span>
                  </div>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded border border-emerald-200">
                    Registered Active
                  </span>
                </div>
              ) : (
                <div className="text-[10px] text-gray-405 italic">
                  * Please select your meal options below to place your order.
                </div>
              )}
            </div>

            {/* Step 1 — Thali selector */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Step 1: Choose Your Thali
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {menu.thalis.map((mt) => {
                  const thali = mt.thali;
                  const isSelected = thali.id === selectedThaliId;
                  return (
                    <button
                      key={thali.id}
                      onClick={() => {
                        setSelectedThaliId(thali.id);
                        setSelectedSabjis({});
                      }}
                      className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between h-full transition-all cursor-pointer shadow-sm relative ${
                        isSelected
                          ? "border-orange-500 bg-orange-500/5 ring-1 ring-orange-500"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className="space-y-1.5 w-full">
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-bold text-sm block text-gray-900 leading-snug truncate">
                            {thali.name}
                          </span>
                          <span
                            className={`text-xs font-extrabold px-2 py-0.5 rounded-lg border flex-shrink-0 ${
                              isSelected
                                ? "bg-orange-500 text-white border-orange-500"
                                : "bg-gray-50 text-gray-800 border-gray-200"
                            }`}
                          >
                            {formatCurrency(thali.price)}
                          </span>
                        </div>
                        {thali.nameGu && (
                          <span className="text-[10px] text-gray-500 font-medium block truncate -mt-1">
                            {thali.nameGu}
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400 block font-semibold">
                          {thali.sabjiCount > 0
                            ? `Choice of ${thali.sabjiCount} Sabji`
                            : "Fixed contents"}
                        </span>
                        {/* Fixed items chips */}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {thali.items.map((item) => (
                            <span
                              key={item.id}
                              className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-md"
                            >
                              {item.itemName}
                            </span>
                          ))}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2 — Sabji selector */}
            {selectedMenuThali && selectedMenuThali.thali.sabjiCount > 0 && (
              <div className="space-y-3 bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                <div className="flex justify-between items-start border-b border-gray-100 pb-2 gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Step 2: Choose Sabji
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {selectedMenuThali.thali.sabjiCount === 1
                        ? "Choose 1 sabji from the options below"
                        : `Choose exactly ${selectedMenuThali.thali.sabjiCount} sabjis from the options below`}
                    </p>
                  </div>
                  <span className="text-[10px] bg-orange-50 text-orange-600 font-bold px-2 py-0.5 rounded-md border border-orange-100 whitespace-nowrap flex-shrink-0">
                    {(selectedSabjis[selectedMenuThali.thali.id] ?? []).length} /{" "}
                    {selectedMenuThali.thali.sabjiCount} selected
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {menu.sabjiOptions
                    .filter(
                      (opt) =>
                        opt.categoryId === selectedMenuThali.thali.categoryId
                    )
                    .map((opt) => {
                      const isChecked = (
                        selectedSabjis[selectedMenuThali.thali.id] ?? []
                      ).includes(opt.productId);
                      const currentCount = (selectedSabjis[selectedMenuThali.thali.id] ?? []).length;
                      const sabjiLimit = selectedMenuThali.thali.sabjiCount;
                      const atMax = currentCount >= sabjiLimit && !isChecked;
                      const isDisabled = atMax && sabjiLimit > 1;

                      return (
                        <button
                          key={opt.id}
                          onClick={() =>
                            toggleSabji(
                              selectedMenuThali.thali.id,
                              opt.productId,
                              sabjiLimit
                            )
                          }
                          disabled={isDisabled}
                          className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                            isChecked
                              ? "border-orange-400 bg-orange-50"
                              : isDisabled
                              ? "border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed"
                              : atMax && sabjiLimit === 1
                              ? "border-gray-200 bg-white hover:border-orange-300 cursor-pointer opacity-70"
                              : "border-gray-200 bg-white hover:border-orange-300 cursor-pointer"
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                              isChecked
                                ? "bg-orange-500 border-orange-500"
                                : "border-gray-300 bg-white"
                            }`}
                          >
                            {isChecked && (
                              <CheckCircle
                                size={11}
                                className="text-white fill-white"
                              />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-bold text-gray-800 block truncate">
                              {opt.product.name}
                            </span>
                            {opt.product.nameGu && (
                              <span className="text-[9px] text-gray-400 block truncate">
                                {opt.product.nameGu}
                              </span>
                            )}
                          </div>
                          {atMax && sabjiLimit === 1 && !isChecked && (
                            <span className="text-[8px] text-orange-400 font-bold flex-shrink-0 whitespace-nowrap">
                              Change
                            </span>
                          )}
                        </button>
                      );
                    })}

                  {menu.sabjiOptions.filter(
                    (opt) =>
                      opt.categoryId === selectedMenuThali.thali.categoryId
                  ).length === 0 && (
                    <p className="col-span-full text-xs text-gray-400 italic py-2 text-center">
                      No sabjis available for this thali today.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Step 3 — Add-ons */}
            {addOns.length > 0 && (
              <div className="space-y-3 bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                  <PackagePlus size={14} className="text-purple-500" />
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Add-Ons{" "}
                    <span className="text-gray-350 font-normal normal-case ml-1">
                      (Optional)
                    </span>
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {addOns.map((addon) => {
                    const qty = selectedAddons[addon.id] ?? 0;
                    const isSelected = qty > 0;
                    return (
                      <div
                        key={addon.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 transition-all ${
                          isSelected
                            ? "border-purple-400 bg-purple-50"
                            : "border-gray-200 bg-white hover:border-purple-300"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-bold text-gray-800 block truncate">
                            {addon.name}
                          </span>
                          {addon.nameGu && (
                            <span className="text-[9px] text-gray-400 block truncate">
                              {addon.nameGu}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span
                            className={`text-xs font-bold ${
                              isSelected ? "text-purple-700" : "text-gray-700"
                            }`}
                          >
                            +{formatCurrency(addon.price)}
                          </span>

                          {!isSelected ? (
                            <button
                              onClick={() => updateAddonQty(addon.id, 1)}
                              className="text-[10px] font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                            >
                              + Add
                            </button>
                          ) : (
                            <div className="flex items-center bg-white border border-purple-200 rounded-lg overflow-hidden">
                              <button
                                onClick={() => updateAddonQty(addon.id, -1)}
                                className="p-1 text-purple-600 hover:bg-purple-50 transition-colors cursor-pointer"
                              >
                                <Minus size={10} className="stroke-[3]" />
                              </button>
                              <span className="px-1.5 text-xs font-extrabold text-purple-700 min-w-[1rem] text-center select-none">
                                {qty}
                              </span>
                              <button
                                onClick={() => updateAddonQty(addon.id, 1)}
                                disabled={qty >= 10}
                                className={`p-1 transition-colors cursor-pointer ${
                                  qty >= 10
                                    ? "text-gray-300 cursor-not-allowed"
                                    : "text-purple-600 hover:bg-purple-50"
                                }`}
                              >
                                <Plus size={10} className="stroke-[3]" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Sticky Summary & Checkout */}
          <div className="md:col-span-1 space-y-4 md:sticky md:top-6">
            {selectedMenuThali && (
              <>
                <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2">
                    Order Summary
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-2 text-gray-700 font-medium">
                      <span className="min-w-0 flex-1 break-words">{selectedMenuThali.thali.name}</span>
                      <span className="font-semibold flex-shrink-0">
                        {formatCurrency(selectedMenuThali.thali.price)}
                      </span>
                    </div>
                    {Object.entries(selectedAddons).map(([id, qty]) => {
                      const addon = addOns.find((a) => a.id === id);
                      if (!addon) return null;
                      return (
                        <div key={id} className="flex justify-between items-center gap-2 text-sm text-gray-500">
                          <span className="min-w-0 flex-1 truncate">+ {addon.name} x{qty}</span>
                          <span className="flex-shrink-0">+{formatCurrency(addon.price * qty)}</span>
                        </div>
                      );
                    })}
                    <div className="border-t border-gray-100 pt-2 flex justify-between items-center gap-2 font-bold text-gray-900">
                      <span>Total</span>
                      <span className="text-orange-600 text-base flex-shrink-0">
                        {formatCurrency(computeTotal())}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="
                  fixed bottom-0 left-0 right-0 z-30
                  px-4 pb-6 pt-3
                  bg-white/95 backdrop-blur-sm border-t border-gray-100 shadow-lg
                  md:relative md:bottom-auto md:left-auto md:right-auto md:z-auto
                  md:px-0 md:pb-0 md:pt-0 md:bg-transparent md:border-t-0 md:shadow-none md:backdrop-blur-none
                ">
                  <button
                    onClick={handlePlaceOrder}
                    disabled={!canOrder || cutoffExpired}
                    className={`w-full py-4 rounded-xl font-bold text-sm transition-all duration-200 shadow-sm cursor-pointer ${
                      canOrder && !cutoffExpired
                        ? "bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white shadow-orange-500/20"
                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    {cutoffExpired
                      ? "⏰ Ordering Closed"
                      : !validateSabjiSelection() && selectedMenuThali.thali.sabjiCount > 0
                      ? `Select ${selectedMenuThali.thali.sabjiCount} sabji(s) to continue`
                      : userInfo
                      ? "Place Order →"
                      : "Place Order — Verify to Continue →"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* OTP Flow Modal */}
      {(pageState === "phone_input" || pageState === "otp_pending") && (
        <OtpModal
          state={pageState}
          onPhoneSubmit={handlePhoneSubmit}
          onOtpVerify={handleOtpVerify}
          otpSending={otpSending}
          onClose={() => setPageState("menu")}
        />
      )}

      {/* Order Confirmation Modal */}
      {pageState === "confirming" && userInfo && selectedMenuThali && (
        <OrderConfirmModal
          user={userInfo}
          thaliName={selectedMenuThali.thali.name}
          thaliNameGu={selectedMenuThali.thali.nameGu}
          thaliPrice={selectedMenuThali.thali.price}
          selectedSabjiNames={
            (selectedSabjis[selectedMenuThali.thali.id] ?? [])
              .map((id) => {
                const opt = menu.sabjiOptions.find((o) => o.productId === id);
                return opt?.product.name ?? "";
              })
              .filter(Boolean)
          }
          selectedAddons={Object.entries(selectedAddons)
            .map(([id, qty]) => {
              const addon = addOns.find((a) => a.id === id);
              if (!addon) return null;
              return { ...addon, quantity: qty };
            })
            .filter(Boolean) as { id: string; name: string; nameGu?: string | null; price: number; quantity: number }[]}
          totalAmount={computeTotal()}
          onConfirm={handleConfirmOrder}
          onBack={() => setPageState("menu")}
          isLoading={placingOrder}
        />
      )}
    </div>
  );
}
