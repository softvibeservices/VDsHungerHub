"use client";

import { useState, useEffect } from "react";
import { Save, AlertTriangle } from "lucide-react";
import Button from "@/components/ui/Button";
import TimeField from "@/components/ui/TimeField";
import ToggleSwitch from "@/components/ui/ToggleSwitch";
import OrderWindowTimeline from "./_OrderWindowTimeline";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import useDirtyState from "@/hooks/useDirtyState";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface MealSetting {
  id: string;
  mealType: "LUNCH" | "DINNER";
  cutoffTime: string;
  menuVisibleFrom: string;
  isOrderingOpen: boolean;
  updatedAt?: string;
}

interface MealSettingsCardProps {
  setting: MealSetting;
  isSaving: boolean;
  onSave: (setting: MealSetting) => void;
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return "";
  }
}

export default function MealSettingsCard({
  setting,
  isSaving,
  onSave,
}: MealSettingsCardProps) {
  const [draft, setDraft] = useState<MealSetting>(setting);
  const [snapshot, setSnapshot] = useState<MealSetting>(setting);

  // Sync draft and snapshot if the parent updates the setting (e.g. after a successful save)
  useEffect(() => {
    setDraft(setting);
    setSnapshot(setting);
  }, [setting]);

  const isDirty = useDirtyState(draft, snapshot);

  // Confirm close ordering modal state
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const handleFieldChange = (field: keyof MealSetting, value: any) => {
    if (field === "isOrderingOpen" && value === false && snapshot.isOrderingOpen === true) {
      // Prompt before closing ordering
      setShowCloseConfirm(true);
    } else {
      setDraft((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleConfirmClose = () => {
    setDraft((prev) => ({ ...prev, isOrderingOpen: false }));
    setShowCloseConfirm(false);
  };

  const handleSaveClick = () => {
    if (!isDirty) return;
    onSave(draft);
  };

  const lastSavedText = formatRelativeTime(setting.updatedAt);
  const isLunch = setting.mealType === "LUNCH";

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between h-full">
      <div className="space-y-4">
        {/* Card Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex flex-col">
            <h3 className="font-extrabold text-gray-800 flex items-center gap-2">
              <span className="text-lg">{isLunch ? "🌞" : "🌙"}</span>{" "}
              {isLunch ? "Lunch" : "Dinner"} Ordering Settings
            </h3>
            {lastSavedText && (
              <span className="text-[10px] text-gray-400 font-medium mt-0.5">
                Last saved {lastSavedText}
              </span>
            )}
          </div>
          <span
            className={cn(
              "text-[10px] font-bold px-2 py-0.5 rounded-full",
              isLunch
                ? "bg-orange-50 text-orange-600 border border-orange-100"
                : "bg-indigo-50 text-indigo-600 border border-indigo-100"
            )}
          >
            Active
          </span>
        </div>

        {/* Form Inputs */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TimeField
              label="Ordering Cutoff Time"
              value={draft.cutoffTime}
              onChange={(e) => handleFieldChange("cutoffTime", e.target.value)}
              hint="Cutoff time (IST)."
            />

            <TimeField
              label="Menu Visible From"
              value={draft.menuVisibleFrom}
              onChange={(e) => handleFieldChange("menuVisibleFrom", e.target.value)}
              hint="Browsing start time (IST)."
            />
          </div>

          {/* Interactive Scheduling Timeline */}
          <OrderWindowTimeline
            menuVisibleFrom={draft.menuVisibleFrom}
            cutoffTime={draft.cutoffTime}
            mealType={draft.mealType}
          />

          {/* Manual Open Override */}
          <ToggleSwitch
            checked={draft.isOrderingOpen}
            onChange={(checked) => handleFieldChange("isOrderingOpen", checked)}
            label="Ordering Open"
            description="Manual override to temporarily open or close customer ordering."
          />
        </div>
      </div>

      {/* Card Footer Actions */}
      <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-[11px] text-gray-400 leading-relaxed max-w-[240px]">
          This is the default. Override cutoffs for specific dates on the{" "}
          <Link
            href="/daily-menu"
            className="font-bold text-orange-500 hover:text-orange-600 underline"
          >
            Daily Menu
          </Link>{" "}
          page.
        </p>
        <Button
          variant="primary"
          leftIcon={<Save size={15} />}
          disabled={!isDirty}
          onClick={handleSaveClick}
          isLoading={isSaving}
          className={cn("w-full sm:w-auto", isDirty && "animate-pulse")}
        >
          Save {isLunch ? "Lunch" : "Dinner"} Settings
        </Button>
      </div>

      {/* Confirmation modal before closing ordering manually */}
      <ConfirmDialog
        isOpen={showCloseConfirm}
        onClose={() => setShowCloseConfirm(false)}
        onConfirm={handleConfirmClose}
        title={`Stop ${isLunch ? "Lunch" : "Dinner"} Ordering?`}
        message={`This immediately blocks customers from placing ${
          isLunch ? "Lunch" : "Dinner"
        } orders, regardless of the cutoff time. Existing orders are unaffected.`}
        confirmLabel="Yes, Stop Ordering"
      />
    </div>
  );
}
