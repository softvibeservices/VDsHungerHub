"use client";

import { useState } from "react";
import { BookmarkPlus } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

interface SaveTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  mealType: "LUNCH" | "DINNER";
  onSave: (name: string) => void;
}

export default function SaveTemplateModal({
  isOpen,
  onClose,
  mealType,
  onSave,
}: SaveTemplateModalProps) {
  const [name, setName] = useState("");

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name.trim());
    setName("");
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Save ${mealType === "LUNCH" ? "Lunch" : "Dinner"} Template`}
      size="sm"
      footer={
        <div className="flex gap-2 w-full justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={!name.trim()}
            leftIcon={<BookmarkPlus size={14} />}
          >
            Save Template
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-gray-500 leading-relaxed">
          Give this template a name so you can reuse its thali selections and sabji settings later with a single click.
        </p>
        <input
          type="text"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder="e.g. Regular Lunch, Friday Special..."
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
        />
      </div>
    </Modal>
  );
}
