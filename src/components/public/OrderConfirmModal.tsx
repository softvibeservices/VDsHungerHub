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
  quantity: number;
}

interface OrderConfirmModalProps {
  user: UserInfo;
  thaliName: string;
  thaliNameGu?: string | null;
  thaliPrice: number;
  selectedSabjiNames: string[];
  selectedAddons: AddonProduct[];
  totalAmount: number;
  deliveryAddress?: string;
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
  deliveryAddress,
  onConfirm,
  onBack,
  isLoading,
}: OrderConfirmModalProps) {
  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" />
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4">
        <div className="bg-white rounded-3xl p-4 sm:p-6 w-full max-w-md shadow-2xl space-y-4 sm:space-y-5 max-h-[90dvh] overflow-y-auto animate-in slide-in-from-bottom duration-300 sm:zoom-in-95">
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
              Ordering As & Delivery Address
            </p>
            <p className="font-bold text-gray-900 text-sm sm:text-base truncate">{user.name}</p>
            <p className="text-xs sm:text-sm text-gray-600 truncate">{user.companyName}</p>
            <p className="text-xs sm:text-sm text-gray-450">+91 {user.number}</p>
            {deliveryAddress && (
              <div className="border-t border-orange-200/60 pt-2 mt-2">
                <p className="text-[10px] font-bold text-orange-700 uppercase tracking-wider mb-0.5">Delivery To:</p>
                <p className="text-xs text-gray-700 leading-normal line-clamp-2">{deliveryAddress}</p>
              </div>
            )}
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
                    <span className="text-gray-700">
                      {addon.name}{" "}
                      <span className="text-xs text-gray-450 font-normal">
                        x{addon.quantity}
                      </span>
                    </span>
                    <span className="font-semibold text-gray-800">
                      +{formatCurrency(addon.price * addon.quantity)}
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
          <div className="flex flex-col-reverse min-[480px]:flex-row gap-2.5 sm:gap-3">
            <button
              onClick={onBack}
              disabled={isLoading}
              className="w-full min-[480px]:flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-colors disabled:opacity-40 cursor-pointer"
            >
              Go Back
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="w-full min-[480px]:flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition-colors disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
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
