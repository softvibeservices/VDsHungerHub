"use client";

import { AlertTriangle, Loader2, ShoppingBag } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface UserInfo {
  id: string;
  name: string;
  number: string;
  companyName: string;
}

interface AddonProduct {
  id: string;
  name: string;
  nameGu?: string | null;
  price: number;
}

interface OrderConfirmModalProps {
  user: UserInfo;
  thaliName: string;
  thaliNameGu?: string | null;
  thaliPrice: number;
  selectedSabjiNames: string[];
  selectedAddons: AddonProduct[];
  totalAmount: number;
  onConfirm: () => void;
  onBack: () => void;
  isLoading: boolean;
}

export default function OrderConfirmModal({
  user,
  thaliName,
  thaliNameGu,
  thaliPrice,
  selectedSabjiNames,
  selectedAddons,
  totalAmount,
  onConfirm,
  onBack,
  isLoading,
}: OrderConfirmModalProps) {
  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" />
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5 animate-in slide-in-from-bottom duration-300 sm:slide-in-from-bottom-0 sm:zoom-in-95">
          {/* Header */}
          <div className="text-center">
            <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <ShoppingBag className="text-orange-600" size={22} />
            </div>
            <h2 className="text-xl font-extrabold text-gray-900">
              Confirm Your Order
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Review carefully — orders cannot be cancelled after confirmation
            </p>
          </div>

          {/* User details */}
          <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 space-y-1.5">
            <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-2">
              Ordering As
            </p>
            <p className="font-bold text-gray-900 text-base">{user.name}</p>
            <p className="text-sm text-gray-600">{user.companyName}</p>
            <p className="text-sm text-gray-400">+91 {user.number}</p>
          </div>

          {/* Order summary */}
          <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Order Summary
            </p>

            {/* Thali line */}
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-gray-900 text-sm">{thaliName}</p>
                {thaliNameGu && (
                  <p className="text-xs text-gray-400">{thaliNameGu}</p>
                )}
              </div>
              <p className="font-bold text-gray-800 text-sm">
                {formatCurrency(thaliPrice)}
              </p>
            </div>

            {/* Sabji selection */}
            {selectedSabjiNames.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-1.5">Sabji choice:</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedSabjiNames.map((name) => (
                    <span
                      key={name}
                      className="text-xs bg-white border border-gray-200 px-2 py-1 rounded-full text-gray-700"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Add-ons */}
            {selectedAddons.length > 0 && (
              <div className="border-t border-gray-200 pt-3 space-y-1.5">
                <p className="text-xs text-gray-400 mb-1.5">Add-ons:</p>
                {selectedAddons.map((addon) => (
                  <div key={addon.id} className="flex justify-between items-center text-sm">
                    <span className="text-gray-700">{addon.name}</span>
                    <span className="font-semibold text-gray-800">
                      +{formatCurrency(addon.price)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Total */}
            <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
              <p className="font-bold text-gray-900">Total</p>
              <p className="font-extrabold text-orange-600 text-lg">
                {formatCurrency(totalAmount)}
              </p>
            </div>
          </div>

          {/* No-cancellation warning */}
          <div className="flex gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <AlertTriangle
              className="text-amber-600 flex-shrink-0 mt-0.5"
              size={16}
            />
            <p className="text-xs text-amber-700 font-medium">
              Once confirmed, this order cannot be cancelled. Please verify
              your details carefully.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onBack}
              disabled={isLoading}
              className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-colors disabled:opacity-40"
            >
              Go Back
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 size={16} className="animate-spin" />}
              {isLoading ? "Placing…" : "Yes, Confirm"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
