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
  isPublished: boolean;
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
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);

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

  const toggleAddon = (addonId: string) => {
    setSelectedAddonIds((prev) =>
      prev.includes(addonId)
        ? prev.filter((id) => id !== addonId)
        : [...prev, addonId]
    );
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
    const addonsTotal = selectedAddonIds
      .map((id) => addOns.find((a) => a.id === id)?.price ?? 0)
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
        const err = await verifyRes.json();
        toast.error(err.error ?? "Verification failed");
        return;
      }

      const { token, user } = await verifyRes.json();
      storeJwt(token);
      setUserInfo(user);
      toast.success(`Welcome, ${user.name}!`);
      setPageState("confirming");
    } catch {
      toast.error("Incorrect OTP. Please try again.");
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
          selectedAddonIds,
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
    <div className="min-h-screen bg-gray-50/50 py-10 px-4 md:px-6">
      {/* Invisible reCAPTCHA container — required by Firebase */}
      <div ref={recaptchaContainerRef} id="recaptcha-container" />

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-md">
            <UtensilsCrossed className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              VD&apos;s Hunger Hub
            </h1>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Fresh Tiffin, Delivered Daily
            </p>
          </div>
        </div>

        {/* Date / Meal info card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">
              Today&apos;s Menu:
            </p>
            <p className="text-base font-bold text-gray-800 mt-0.5">{dateStr}</p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`text-xs px-3 py-1 rounded-full font-bold uppercase ${
                isLunch
                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                  : "bg-indigo-50 text-indigo-700 border border-indigo-200"
              }`}
            >
              {isLunch ? "🌅 Lunch" : "🌙 Dinner"}
            </span>
            {menu.cutoffTime && (
              <span
                className={`text-xs flex items-center gap-1 font-semibold ${
                  cutoffExpired ? "text-red-600" : "text-red-500"
                }`}
              >
                <Clock size={13} />
                Cutoff: {formatTimeIST(menu.cutoffTime)}
              </span>
            )}
          </div>
        </div>

        {/* Logged-in user banner */}
        {userInfo && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2.5">
            <CheckCircle className="text-green-500 flex-shrink-0" size={16} />
            <div className="text-sm">
              <span className="font-bold text-gray-800">{userInfo.name}</span>
              <span className="text-gray-500 ml-1">({userInfo.companyName})</span>
            </div>
          </div>
        )}

        {/* Step 1 — Thali selector */}
        <div className="space-y-2.5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Step 1: Choose Your Thali
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
                  className={`p-4 rounded-2xl border text-left flex justify-between items-start transition-all cursor-pointer shadow-sm ${
                    isSelected
                      ? "border-orange-500 bg-orange-500/5 ring-1 ring-orange-500"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="space-y-1">
                    <span className="font-bold text-sm block text-gray-900">
                      {thali.name}
                    </span>
                    {thali.nameGu && (
                      <span className="text-xs text-gray-500 font-medium block">
                        {thali.nameGu}
                      </span>
                    )}
                    <span className="text-[11px] text-gray-500 block">
                      {thali.sabjiCount > 0
                        ? `Choice of ${thali.sabjiCount} Sabji`
                        : "Fixed contents"}
                    </span>
                    {/* Fixed items chips */}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {thali.items.map((item) => (
                        <span
                          key={item.id}
                          className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-md"
                        >
                          {item.itemName}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span
                    className={`text-sm font-extrabold px-2.5 py-0.5 rounded-lg border flex-shrink-0 ml-2 ${
                      isSelected
                        ? "bg-orange-500 text-white border-orange-500"
                        : "bg-gray-50 text-gray-800 border-gray-200"
                    }`}
                  >
                    {formatCurrency(thali.price)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2 — Sabji selector (only if selected thali has sabji) */}
        {selectedMenuThali && selectedMenuThali.thali.sabjiCount > 0 && (
          <div className="space-y-3 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="flex justify-between items-baseline border-b border-gray-100 pb-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Step 2: Choose Sabji
              </p>
              <span className="text-[10px] bg-orange-50 text-orange-600 font-bold px-2 py-0.5 rounded-md border border-orange-100">
                {(selectedSabjis[selectedMenuThali.thali.id] ?? []).length} /{" "}
                {selectedMenuThali.thali.sabjiCount} selected
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {menu.sabjiOptions
                .filter(
                  (opt) =>
                    opt.categoryId === selectedMenuThali.thali.categoryId
                )
                .map((opt) => {
                  const isChecked = (
                    selectedSabjis[selectedMenuThali.thali.id] ?? []
                  ).includes(opt.productId);
                  const atMax =
                    (selectedSabjis[selectedMenuThali.thali.id] ?? []).length >=
                      selectedMenuThali.thali.sabjiCount && !isChecked;

                  return (
                    <button
                      key={opt.id}
                      onClick={() =>
                        toggleSabji(
                          selectedMenuThali.thali.id,
                          opt.productId,
                          selectedMenuThali.thali.sabjiCount
                        )
                      }
                      disabled={atMax}
                      className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all ${
                        isChecked
                          ? "border-orange-400 bg-orange-50"
                          : atMax
                          ? "border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed"
                          : "border-gray-200 bg-white hover:border-orange-300 cursor-pointer"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                          isChecked
                            ? "bg-orange-500 border-orange-500"
                            : "border-gray-300 bg-white"
                        }`}
                      >
                        {isChecked && (
                          <CheckCircle
                            size={13}
                            className="text-white fill-white"
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-gray-800 block truncate">
                          {opt.product.name}
                        </span>
                        {opt.product.nameGu && (
                          <span className="text-[10px] text-gray-400 block truncate">
                            {opt.product.nameGu}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}

              {menu.sabjiOptions.filter(
                (opt) =>
                  opt.categoryId === selectedMenuThali.thali.categoryId
              ).length === 0 && (
                <p className="col-span-2 text-xs text-gray-400 italic py-2 text-center">
                  No sabjis available for this thali today.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 3 — Add-ons (optional) */}
        {addOns.length > 0 && (
          <div className="space-y-3 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
              <PackagePlus size={15} className="text-purple-500" />
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Add-Ons{" "}
                <span className="text-gray-300 font-normal normal-case ml-1">
                  (Optional)
                </span>
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {addOns.map((addon) => {
                const isSelected = selectedAddonIds.includes(addon.id);
                return (
                  <button
                    key={addon.id}
                    onClick={() => toggleAddon(addon.id)}
                    className={`p-3 rounded-xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer ${
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
                        <span className="text-[10px] text-gray-400 block truncate">
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
                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                          isSelected
                            ? "bg-purple-500 border-purple-500 text-white"
                            : "border-gray-300 bg-white text-gray-400"
                        }`}
                      >
                        {isSelected ? (
                          <Minus size={12} />
                        ) : (
                          <Plus size={12} />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Bill summary + Place Order */}
        {selectedMenuThali && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
            {/* Bill breakdown */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-700">
                <span>{selectedMenuThali.thali.name}</span>
                <span className="font-semibold">
                  {formatCurrency(selectedMenuThali.thali.price)}
                </span>
              </div>
              {selectedAddonIds.map((id) => {
                const addon = addOns.find((a) => a.id === id);
                if (!addon) return null;
                return (
                  <div key={id} className="flex justify-between text-gray-500">
                    <span>+ {addon.name}</span>
                    <span>+{formatCurrency(addon.price)}</span>
                  </div>
                );
              })}
              <div className="border-t border-gray-100 pt-2 flex justify-between font-bold text-gray-900">
                <span>Total</span>
                <span className="text-orange-600 text-base">
                  {formatCurrency(computeTotal())}
                </span>
              </div>
            </div>

            {/* Place Order button */}
            <button
              onClick={handlePlaceOrder}
              disabled={!canOrder || cutoffExpired}
              className={`w-full py-4 rounded-xl font-bold text-sm transition-all duration-200 shadow-sm ${
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
        )}
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
          selectedAddons={selectedAddonIds
            .map((id) => addOns.find((a) => a.id === id))
            .filter(Boolean) as { id: string; name: string; nameGu?: string | null; price: number }[]}
          totalAmount={computeTotal()}
          onConfirm={handleConfirmOrder}
          onBack={() => setPageState("menu")}
          isLoading={placingOrder}
        />
      )}
    </div>
  );
}
