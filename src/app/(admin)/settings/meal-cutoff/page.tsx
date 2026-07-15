"use client";

import { useEffect, useState } from "react";
import { Settings, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import MealSettingsCard from "./_MealSettingsCard";

interface MealSetting {
  id: string;
  mealType: "LUNCH" | "DINNER";
  cutoffTime: string;
  menuVisibleFrom: string;
  isOrderingOpen: boolean;
  updatedAt?: string;
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

      // Update local state with the returned setting (including updatedAt timestamp)
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
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-orange-500" size={32} />
      </div>
    );
  }

  const lunch = settings.find((s) => s.mealType === "LUNCH");
  const dinner = settings.find((s) => s.mealType === "DINNER");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2 leading-tight">
          <Settings size={20} className="text-gray-500" />
          Cutoff & Ordering Settings
        </h2>
        <p className="text-xs text-gray-400 font-medium mt-0.5">
          Configure default ordering rules and visibility schedules for Lunch and Dinner.
        </p>
      </div>

      {/* Grid containing Settings Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
