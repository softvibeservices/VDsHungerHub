"use client";

import { useEffect, useState } from "react";
import { Loader2, Clock, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import MealSettingsCard from "../../settings/meal-cutoff/_MealSettingsCard";
import PageToolbar from "@/components/ui/PageToolbar";

interface MealSetting {
  id: string;
  mealType: "LUNCH" | "DINNER";
  cutoffTime: string;
  menuVisibleFrom: string;
  isOrderingOpen: boolean;
  updatedAt?: string;
}

export default function ProfileMealCutoffPage() {
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

      setSettings((prev) =>
        prev.map((s) => (s.mealType === setting.mealType ? json.setting ?? setting : s))
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving((prev) => ({ ...prev, [setting.mealType]: false }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="animate-spin text-orange-500" size={32} />
      </div>
    );
  }

  const lunch = settings.find((s) => s.mealType === "LUNCH");
  const dinner = settings.find((s) => s.mealType === "DINNER");

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      <PageToolbar
        filters={
          <div className="flex items-center gap-2 flex-wrap text-xs font-bold">
            <span className="text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full border border-gray-200 flex items-center gap-1.5">
              <Clock size={14} className="text-orange-500 shrink-0" /> All Times in IST (India Standard Time)
            </span>
            <span className="text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-600 shrink-0" /> Automated Ordering Enforcement Active
            </span>
          </div>
        }
      />

      {/* Grid containing Settings Cards — Fully Responsive */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {lunch && (
          <MealSettingsCard
            setting={lunch}
            isSaving={!!isSaving["LUNCH"]}
            onSave={handleSave}
          />
        )}

        {dinner && (
          <MealSettingsCard
            setting={dinner}
            isSaving={!!isSaving["DINNER"]}
            onSave={handleSave}
          />
        )}
      </div>
    </div>
  );
}
