"use client";

import { CheckCircle, Clock, Loader2, Package, Truck, UtensilsCrossed } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

interface Props {
  status: OrderStatus;
  placedAt?: string;
  compact?: boolean; // if true, render horizontal condensed version
}

// ── Step definitions ──────────────────────────────────────────────────────────

interface Step {
  key: OrderStatus;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
}

const STEPS: Step[] = [
  {
    key: "PENDING",
    label: "Order Placed",
    sublabel: "We've received your order",
    icon: <Clock size={16} />,
  },
  {
    key: "CONFIRMED",
    label: "Confirmed",
    sublabel: "Your order is confirmed",
    icon: <CheckCircle size={16} />,
  },
  {
    key: "PREPARING",
    label: "Preparing",
    sublabel: "Freshly cooking your thali",
    icon: <UtensilsCrossed size={16} />,
  },
  {
    key: "OUT_FOR_DELIVERY",
    label: "Out for Delivery",
    sublabel: "On the way to you",
    icon: <Truck size={16} />,
  },
  {
    key: "DELIVERED",
    label: "Delivered",
    sublabel: "Enjoy your meal! 🍽️",
    icon: <Package size={16} />,
  },
];

const STATUS_ORDER: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

function getStepIndex(status: OrderStatus): number {
  return STATUS_ORDER.indexOf(status);
}

// ── OrderStatusTimeline ───────────────────────────────────────────────────────

export default function OrderStatusTimeline({ status, placedAt, compact = false }: Props) {
  const currentIdx = getStepIndex(status);
  const isCancelled = status === "CANCELLED";

  if (isCancelled) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 border border-red-100">
        <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
          <span className="text-lg">✕</span>
        </div>
        <div>
          <p className="font-semibold text-red-700 text-sm">Order Cancelled</p>
          <p className="text-xs text-red-500 mt-0.5">This order was cancelled by admin</p>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STEPS.map((step, idx) => {
          const isDone = idx < currentIdx;
          const isActive = idx === currentIdx;
          return (
            <div key={step.key} className="flex items-center gap-1 shrink-0">
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-orange-500 text-white"
                    : isDone
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {isActive ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : isDone ? (
                  <CheckCircle size={11} />
                ) : (
                  step.icon
                )}
                <span className="hidden sm:inline">{step.label}</span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`w-4 h-0.5 rounded-full ${idx < currentIdx ? "bg-green-400" : "bg-gray-200"}`} />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Full vertical timeline
  return (
    <div className="space-y-0">
      {STEPS.map((step, idx) => {
        const isDone = idx < currentIdx;
        const isActive = idx === currentIdx;
        const isFuture = idx > currentIdx;
        const isLast = idx === STEPS.length - 1;

        return (
          <div key={step.key} className="flex gap-4">
            {/* Left: icon + connector line */}
            <div className="flex flex-col items-center">
              <div
                className={`
                  w-9 h-9 rounded-full flex items-center justify-center shrink-0 border-2 transition-all
                  ${isActive
                    ? "border-orange-500 bg-orange-500 text-white shadow-lg shadow-orange-500/30"
                    : isDone
                    ? "border-green-500 bg-green-500 text-white"
                    : "border-gray-200 bg-white text-gray-300"
                  }
                `}
              >
                {isActive ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : isDone ? (
                  <CheckCircle size={15} />
                ) : (
                  step.icon
                )}
              </div>
              {!isLast && (
                <div
                  className={`w-0.5 flex-1 my-1 min-h-8 rounded-full transition-colors ${
                    isDone ? "bg-green-400" : "bg-gray-200"
                  }`}
                />
              )}
            </div>

            {/* Right: label */}
            <div className={`pb-6 ${isLast ? "pb-2" : ""}`}>
              <p
                className={`font-semibold text-sm leading-tight ${
                  isActive
                    ? "text-orange-600"
                    : isDone
                    ? "text-green-700"
                    : "text-gray-400"
                }`}
              >
                {step.label}
                {isActive && (
                  <span className="ml-2 text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">
                    Now
                  </span>
                )}
              </p>
              <p
                className={`text-xs mt-0.5 ${
                  isFuture ? "text-gray-300" : isActive ? "text-gray-500" : "text-gray-400"
                }`}
              >
                {step.sublabel}
              </p>
              {isActive && placedAt && idx === 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(placedAt).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
