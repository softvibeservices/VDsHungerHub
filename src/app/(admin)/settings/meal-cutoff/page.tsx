"use client";

import { useEffect, useState } from "react";
import { Settings, Save, Loader2, Clock } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useToast } from "@/hooks/useToast";

interface MealSetting {
  id: string;
  mealType: "LUNCH" | "DINNER";
  cutoffTime: string;
  menuVisibleFrom: string;
  isOrderingOpen: boolean;
}

export default function MealCutoffSettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<MealSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<Record<string, boolean>>({});

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/meal-settings");
      if (!res.ok) throw new Error("Failed to load settings");
      const json = await res.json();
      setSettings(json.settings ?? []);
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpdateField = (mealType: "LUNCH" | "DINNER", field: keyof MealSetting, value: any) => {
    setSettings((prev) =>
      prev.map((s) => (s.mealType === mealType ? { ...s, [field]: value } : s))
    );
  };

  const handleSave = async (setting: MealSetting) => {
    setIsSaving((prev) => ({ ...prev, [setting.mealType]: true }));
    try {
      const res = await fetch("/api/admin/meal-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mealType: setting.mealType,
          cutoffTime: setting.cutoffTime,
          menuVisibleFrom: setting.menuVisibleFrom,
          isOrderingOpen: setting.isOrderingOpen,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save");

      toast.success(`${setting.mealType === "LUNCH" ? "Lunch" : "Dinner"} settings saved!`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving((prev) => ({ ...prev, [setting.mealType]: false }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-orange-500" size={32} />
      </div>
    );
  }

  const lunch = settings.find((s) => s.mealType === "LUNCH");
  const dinner = settings.find((s) => s.mealType === "DINNER");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Settings size={20} className="text-gray-500" />
          Cutoff & Ordering Settings
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Configure default ordering rules and visibility schedules for Lunch and Dinner.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Lunch Card */}
        {lunch && (
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <span className="text-lg">🌞</span> Lunch Ordering Settings
              </h3>
              <span className="text-xs bg-orange-50 text-orange-600 font-semibold px-2 py-0.5 rounded-full">
                Active
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <Input
                  label="Ordering Cutoff Time"
                  type="text"
                  placeholder="e.g. 10:30"
                  value={lunch.cutoffTime}
                  onChange={(e) => handleUpdateField("LUNCH", "cutoffTime", e.target.value)}
                />
                <span className="text-[11px] text-gray-400 block mt-1">
                  Orders for Lunch will be rejected after this time (24-hour IST format, e.g. 10:30).
                </span>
              </div>

              <div>
                <Input
                  label="Menu Visible From"
                  type="text"
                  placeholder="e.g. 18:00"
                  value={lunch.menuVisibleFrom}
                  onChange={(e) => handleUpdateField("LUNCH", "menuVisibleFrom", e.target.value)}
                />
                <span className="text-[11px] text-gray-400 block mt-1">
                  When the next day's Lunch menu becomes browsable again (24-hour IST format, e.g. 18:00).
                </span>
              </div>

              <label className="flex items-start gap-3 select-none cursor-pointer border border-gray-100 rounded-xl p-3 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                <input
                  type="checkbox"
                  checked={lunch.isOrderingOpen}
                  onChange={(e) => handleUpdateField("LUNCH", "isOrderingOpen", e.target.checked)}
                  className="rounded mt-0.5 border-gray-300 text-orange-600 focus:ring-orange-500"
                />
                <div>
                  <span className="text-sm font-bold text-gray-700 block">Ordering Open</span>
                  <span className="text-xs text-gray-400 block mt-0.5">
                    Manual override to temporarily open or close ordering.
                  </span>
                </div>
              </label>
            </div>

            <div className="pt-2 border-t border-gray-100 flex justify-end">
              <Button
                variant="primary"
                leftIcon={<Save size={15} />}
                onClick={() => handleSave(lunch)}
                isLoading={isSaving["LUNCH"]}
              >
                Save Lunch Settings
              </Button>
            </div>
          </div>
        )}

        {/* Dinner Card */}
        {dinner && (
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <span className="text-lg">🌙</span> Dinner Ordering Settings
              </h3>
              <span className="text-xs bg-indigo-50 text-indigo-600 font-semibold px-2 py-0.5 rounded-full">
                Active
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <Input
                  label="Ordering Cutoff Time"
                  type="text"
                  placeholder="e.g. 16:00"
                  value={dinner.cutoffTime}
                  onChange={(e) => handleUpdateField("DINNER", "cutoffTime", e.target.value)}
                />
                <span className="text-[11px] text-gray-400 block mt-1">
                  Orders for Dinner will be rejected after this time (24-hour IST format, e.g. 16:00).
                </span>
              </div>

              <div>
                <Input
                  label="Menu Visible From"
                  type="text"
                  placeholder="e.g. 21:00"
                  value={dinner.menuVisibleFrom}
                  onChange={(e) => handleUpdateField("DINNER", "menuVisibleFrom", e.target.value)}
                />
                <span className="text-[11px] text-gray-400 block mt-1">
                  When the next cycle's Dinner menu becomes browsable again (24-hour IST format, e.g. 21:00).
                </span>
              </div>

              <label className="flex items-start gap-3 select-none cursor-pointer border border-gray-100 rounded-xl p-3 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                <input
                  type="checkbox"
                  checked={dinner.isOrderingOpen}
                  onChange={(e) => handleUpdateField("DINNER", "isOrderingOpen", e.target.checked)}
                  className="rounded mt-0.5 border-gray-300 text-orange-600 focus:ring-orange-500"
                />
                <div>
                  <span className="text-sm font-bold text-gray-700 block">Ordering Open</span>
                  <span className="text-xs text-gray-400 block mt-0.5">
                    Manual override to temporarily open or close ordering.
                  </span>
                </div>
              </label>
            </div>

            <div className="pt-2 border-t border-gray-100 flex justify-end">
              <Button
                variant="primary"
                leftIcon={<Save size={15} />}
                onClick={() => handleSave(dinner)}
                isLoading={isSaving["DINNER"]}
              >
                Save Dinner Settings
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex gap-3 shadow-inner">
        <Clock className="text-orange-500 flex-shrink-0 mt-0.5" size={16} />
        <p className="text-xs text-orange-800 leading-relaxed font-medium">
          💡 <strong>Note on scheduling:</strong> Default settings defined here will guide the customer ordering experience. They are enforced server-side upon order submission. Admins can still define overrides per specific daily menu if needed during publishing.
        </p>
      </div>
    </div>
  );
}
