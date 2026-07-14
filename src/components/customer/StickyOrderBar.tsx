"use client";

import { ShoppingBag, ChevronRight } from "lucide-react";

interface Props {
  thaliCount: number;
  totalAmount: number;
  onViewOrder: () => void;
  disabled?: boolean;
}

/**
 * StickyOrderBar — mobile-only bottom bar (hidden on md+)
 * Appears once ≥1 thali is added to the cart.
 * Shows "N Thali(s) · ₹XXX · Place Order →"
 */
export default function StickyOrderBar({ thaliCount, totalAmount, onViewOrder, disabled = false }: Props) {
  if (thaliCount === 0) return null;

  const label = thaliCount === 1 ? "1 Thali" : `${thaliCount} Thalis`;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-4 pb-safe-bottom pb-4 pointer-events-none">
      <button
        id="sticky-order-bar"
        type="button"
        disabled={disabled}
        onClick={onViewOrder}
        className="
          w-full pointer-events-auto
          flex items-center justify-between
          bg-gradient-to-r from-orange-500 to-orange-600
          text-white font-bold
          px-5 py-4 rounded-2xl
          shadow-2xl shadow-orange-500/40
          disabled:opacity-60
          active:scale-[0.98] transition-transform
        "
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
            <ShoppingBag size={16} className="text-white" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold leading-tight">{label}</p>
            <p className="text-xs text-orange-100 font-normal">
              ₹{totalAmount.toFixed(2)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-sm">
          <span>Place Order</span>
          <ChevronRight size={16} />
        </div>
      </button>
    </div>
  );
}
