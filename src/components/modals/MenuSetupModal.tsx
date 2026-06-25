"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";
import { CheckSquare, Square } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface ThaliItem { id: string; itemName: string }
interface Thali {
  id: string; name: string; price: number; maxSabjiCount: number;
  items: ThaliItem[];
}
interface Product { id: string; name: string }

interface MenuSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  date: string;
  mealType: "LUNCH" | "DINNER";
  existingMenuId?: string;
  thalis: Thali[];
  products: Product[];
  initialData?: {
    cutoffTime?: string;
    thaliIds: string[];
    sabjiOptions: { thaliId: string; productIds: string[] }[];
  };
}

export default function MenuSetupModal({
  isOpen, onClose, onSuccess, date, mealType, existingMenuId,
  thalis, products, initialData,
}: MenuSetupModalProps) {
  const toast = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [cutoffTime, setCutoffTime] = useState("");
  const [selectedThaliIds, setSelectedThaliIds] = useState<string[]>([]);
  const [sabjiMap, setSabjiMap] = useState<Record<string, string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setCutoffTime(initialData?.cutoffTime ?? (mealType === "LUNCH" ? "11:30" : "18:30"));
      setSelectedThaliIds(initialData?.thaliIds ?? []);
      const initialSabji: Record<string, string[]> = {};
      initialData?.sabjiOptions?.forEach((s) => { initialSabji[s.thaliId] = s.productIds; });
      setSabjiMap(initialSabji);
    }
  }, [isOpen, initialData, mealType]);

  const toggleThali = (id: string) => {
    setSelectedThaliIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const toggleSabji = (thaliId: string, productId: string) => {
    setSabjiMap((prev) => {
      const current = prev[thaliId] ?? [];
      const next = current.includes(productId)
        ? current.filter((p) => p !== productId)
        : [...current, productId];
      return { ...prev, [thaliId]: next };
    });
  };

  const selectedThalis = thalis.filter((t) => selectedThaliIds.includes(t.id));
  const thalisNeedingSabji = selectedThalis.filter((t) => t.maxSabjiCount > 0);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const sabjiOptions = thalisNeedingSabji.map((t) => ({
        thaliId: t.id,
        productIds: sabjiMap[t.id] ?? [],
      }));

      const url = existingMenuId ? `/api/menu/${existingMenuId}` : "/api/menu";
      const method = existingMenuId ? "PUT" : "POST";

      const body: Record<string, unknown> = {
        cutoffTime,
        thaliIds: selectedThaliIds,
        sabjiOptions,
      };
      if (!existingMenuId) {
        body.date = date;
        body.mealType = mealType;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      toast.success(existingMenuId ? "Menu updated!" : "Menu set!");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepLabels = ["1. Basic Info", "2. Select Thalis", "3. Sabji Options"];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${existingMenuId ? "Edit" : "Set"} ${mealType === "LUNCH" ? "🌅 Lunch" : "🌙 Dinner"} Menu`}
      size="lg"
      footer={
        <>
          {step > 1 && (
            <Button variant="secondary" onClick={() => setStep((s) => (s - 1) as 1 | 2)}>← Back</Button>
          )}
          {step < 3 && (
            <Button
              variant="primary"
              onClick={() => {
                if (step === 1) { setStep(2); }
                else if (step === 2) { if (selectedThaliIds.length === 0) { toast.error("Select at least one thali"); return; } setStep(thalisNeedingSabji.length > 0 ? 3 : 3); }
              }}
            >
              Next →
            </Button>
          )}
          {step === 3 && (
            <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>
              💾 Save Menu
            </Button>
          )}
        </>
      }
    >
      {/* Step indicator */}
      <div className="flex gap-1 mb-5">
        {stepLabels.map((label, i) => (
          <div key={i} className={`flex-1 h-1 rounded-full transition-colors ${i + 1 <= step ? "bg-orange-500" : "bg-gray-200"}`} />
        ))}
      </div>
      <p className="text-xs text-gray-400 mb-4">{stepLabels[step - 1]}</p>

      {/* Step 1: Basic info */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex gap-3 items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700 mb-1">Date</p>
              <p className="text-sm text-gray-900 font-semibold px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                {new Date(date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700 mb-1">Meal Type</p>
              <p className={`text-sm font-semibold px-3 py-2 rounded-lg border ${mealType === "LUNCH" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-indigo-50 text-indigo-700 border-indigo-200"}`}>
                {mealType === "LUNCH" ? "🌅 Lunch" : "🌙 Dinner"}
              </p>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Cutoff Time</label>
            <input
              type="time"
              value={cutoffTime}
              onChange={(e) => setCutoffTime(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
            />
          </div>
        </div>
      )}

      {/* Step 2: Select thalis */}
      {step === 2 && (
        <div className="space-y-2">
          {thalis.map((thali) => {
            const isSelected = selectedThaliIds.includes(thali.id);
            return (
              <button
                key={thali.id}
                type="button"
                onClick={() => toggleThali(thali.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                  isSelected ? "border-orange-400 bg-orange-50" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                {isSelected ? <CheckSquare size={16} className="text-orange-500 flex-shrink-0" /> : <Square size={16} className="text-gray-300 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{thali.name}</p>
                  <p className="text-xs text-gray-500">
                    {formatCurrency(thali.price)} · {thali.maxSabjiCount > 0 ? `Pick ${thali.maxSabjiCount} sabji` : "Fixed items only"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Step 3: Sabji options per thali */}
      {step === 3 && (
        <div className="space-y-5">
          {thalisNeedingSabji.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">No thalis require sabji selection.</p>
            </div>
          ) : (
            thalisNeedingSabji.map((thali) => (
              <div key={thali.id}>
                <p className="text-sm font-semibold text-gray-800 mb-2">
                  🍽 {thali.name}
                  <span className="text-xs text-gray-400 font-normal ml-2">(users pick {thali.maxSabjiCount} from below)</span>
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {products.map((product) => {
                    const isSelected = (sabjiMap[thali.id] ?? []).includes(product.id);
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => toggleSabji(thali.id, product.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-xs transition-all ${
                          isSelected ? "border-orange-400 bg-orange-50 text-orange-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        {isSelected ? <CheckSquare size={13} className="text-orange-500 flex-shrink-0" /> : <Square size={13} className="text-gray-300 flex-shrink-0" />}
                        {product.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}

          {selectedThalis.filter((t) => t.maxSabjiCount === 0).length > 0 && (
            <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
              <p className="text-xs text-gray-500 font-medium mb-1">Fixed-only thalis (no sabji choice):</p>
              {selectedThalis.filter((t) => t.maxSabjiCount === 0).map((t) => (
                <p key={t.id} className="text-xs text-gray-600">• {t.name}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
