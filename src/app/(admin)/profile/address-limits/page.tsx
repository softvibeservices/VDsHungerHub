// src\app\(admin)\profile\address-limits\page.tsx

"use client";

import { useState, useEffect } from "react";
import { MapPin, UtensilsCrossed, PackagePlus, AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";

export default function ProfileOrderAndAddressLimitsPage() {
  const toast = useToast();

  const [addressLimit, setAddressLimit] = useState<string>("");
  const [thaliLimit, setThaliLimit] = useState<string>("");
  const [addonLimit, setAddonLimit] = useState<string>("");

  const [defaults, setDefaults] = useState({
    addressLimit: 5,
    thaliLimit: 10,
    addonLimit: 30,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [isSavingThali, setIsSavingThali] = useState(false);
  const [isSavingAddon, setIsSavingAddon] = useState(false);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/settings/order-limits");
      if (res.ok) {
        const data = await res.json();
        setAddressLimit(String(data.addressLimit ?? 5));
        setThaliLimit(String(data.thaliLimit ?? 10));
        setAddonLimit(String(data.addonLimit ?? 30));
        if (data.defaults) setDefaults(data.defaults);
      }
    } catch {
      toast.error("Failed to load limit settings.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSaveAddress = async (customValue?: number) => {
    const targetValue = customValue ?? parseInt(addressLimit, 10);
    if (!Number.isInteger(targetValue) || targetValue < 5 || targetValue > 20) {
      toast.error("Address limit must be a valid whole number between 5 and 20.");
      return;
    }

    setIsSavingAddress(true);
    try {
      const res = await fetch("/api/admin/settings/order-limits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addressLimit: targetValue }),
      });
      const data = await res.json();
      if (res.ok) {
        setAddressLimit(String(data.addressLimit));
        toast.success(`Saved address limit updated to ${data.addressLimit}.`);
      } else {
        toast.error(data.error || "Failed to update address limit.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleSaveThali = async (customValue?: number) => {
    const targetValue = customValue ?? parseInt(thaliLimit, 10);
    if (!Number.isInteger(targetValue) || targetValue < 1 || targetValue > 50) {
      toast.error("Thali limit per order must be a valid whole number between 1 and 50.");
      return;
    }

    setIsSavingThali(true);
    try {
      const res = await fetch("/api/admin/settings/order-limits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thaliLimit: targetValue }),
      });
      const data = await res.json();
      if (res.ok) {
        setThaliLimit(String(data.thaliLimit));
        toast.success(`Max Thali quantity per order updated to ${data.thaliLimit}.`);
      } else {
        toast.error(data.error || "Failed to update thali limit.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsSavingThali(false);
    }
  };

  const handleSaveAddon = async (customValue?: number) => {
    const targetValue = customValue ?? parseInt(addonLimit, 10);
    if (!Number.isInteger(targetValue) || targetValue < 1 || targetValue > 100) {
      toast.error("Add-on limit per item must be a valid whole number between 1 and 100.");
      return;
    }

    setIsSavingAddon(true);
    try {
      const res = await fetch("/api/admin/settings/order-limits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addonLimit: targetValue }),
      });
      const data = await res.json();
      if (res.ok) {
        setAddonLimit(String(data.addonLimit));
        toast.success(`Max Add-on quantity per item updated to ${data.addonLimit}.`);
      } else {
        toast.error(data.error || "Failed to update add-on limit.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsSavingAddon(false);
    }
  };

  const addressPresets = [5, 8, 10, 15, 20];
  const thaliPresets = [5, 10, 15, 20, 30];
  const addonPresets = [10, 20, 30, 50, 75];

  return (
    <div className="space-y-6 max-w-4xl overflow-x-hidden">
      {/* ── SECTION 1: Max Thali Per Order ────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
            <UtensilsCrossed size={20} className="text-orange-500" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">Max Thalis Per Order Per User (Variable Limit)</h2>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              Configure the maximum number of total Thalis a single customer account can add per order.
            </p>
          </div>
        </div>

        <div className="space-y-3 max-w-md pt-2 border-t border-gray-100">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
            <div className="flex-1">
              <Input
                label="Maximum Thalis Per Order Per User"
                type="number"
                min="1"
                max="50"
                value={thaliLimit}
                onChange={(e) => setThaliLimit(e.target.value)}
                disabled={isLoading}
                placeholder="e.g. 10"
              />
            </div>
            <Button
              variant="primary"
              isLoading={isSavingThali}
              onClick={() => handleSaveThali()}
              className="sm:w-auto w-full"
            >
              Save Limit
            </Button>
          </div>

          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <span className="text-xs font-semibold text-gray-400">Quick Presets:</span>
            {thaliPresets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handleSaveThali(p)}
                disabled={isSavingThali}
                className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  parseInt(thaliLimit, 10) === p
                    ? "border-orange-500 bg-orange-50 text-orange-600 shadow-xs"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                }`}
              >
                {p} {p === defaults.thaliLimit ? "(Default)" : ""}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── SECTION 2: Max Addon Per Item ────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
            <PackagePlus size={20} className="text-orange-500" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">Max Quantity Per Add-on Item (Variable Limit)</h2>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              Configure the maximum allowed quantity for any single extra item/beverage per customer order.
            </p>
          </div>
        </div>

        <div className="space-y-3 max-w-md pt-2 border-t border-gray-100">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
            <div className="flex-1">
              <Input
                label="Maximum Quantity Per Add-on Item"
                type="number"
                min="1"
                max="100"
                value={addonLimit}
                onChange={(e) => setAddonLimit(e.target.value)}
                disabled={isLoading}
                placeholder="e.g. 30"
              />
            </div>
            <Button
              variant="primary"
              isLoading={isSavingAddon}
              onClick={() => handleSaveAddon()}
              className="sm:w-auto w-full"
            >
              Save Limit
            </Button>
          </div>

          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <span className="text-xs font-semibold text-gray-400">Quick Presets:</span>
            {addonPresets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handleSaveAddon(p)}
                disabled={isSavingAddon}
                className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  parseInt(addonLimit, 10) === p
                    ? "border-orange-500 bg-orange-50 text-orange-600 shadow-xs"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                }`}
              >
                {p} {p === defaults.addonLimit ? "(Default)" : ""}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── SECTION 3: Customer Saved Address Limit ──────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
            <MapPin size={20} className="text-orange-500" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">Customer Saved Address Limit</h2>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              Configure the maximum number of delivery addresses a single customer account can save in their address book.
            </p>
          </div>
        </div>

        <div className="space-y-3 max-w-md pt-2 border-t border-gray-100">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
            <div className="flex-1">
              <Input
                label="Maximum Saved Addresses Per Customer"
                type="number"
                min="5"
                max="20"
                value={addressLimit}
                onChange={(e) => setAddressLimit(e.target.value)}
                disabled={isLoading}
                placeholder="e.g. 5"
              />
            </div>
            <Button
              variant="primary"
              isLoading={isSavingAddress}
              onClick={() => handleSaveAddress()}
              className="sm:w-auto w-full"
            >
              Save Limit
            </Button>
          </div>

          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <span className="text-xs font-semibold text-gray-400">Quick Presets:</span>
            {addressPresets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handleSaveAddress(p)}
                disabled={isSavingAddress}
                className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  parseInt(addressLimit, 10) === p
                    ? "border-orange-500 bg-orange-50 text-orange-600 shadow-xs"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                }`}
              >
                {p} {p === defaults.addressLimit ? "(Default)" : ""}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-1.5">
          <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-amber-600 shrink-0" />
            Live System Behavior
          </p>
          <ul className="text-[11px] text-amber-800 space-y-1 leading-relaxed pl-5 list-disc">
            <li>
              Updated limits immediately take effect in the Customer Panel for all ongoing and new orders.
            </li>
            <li>
              API endpoints enforce these dynamic values with clear warning messages.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
