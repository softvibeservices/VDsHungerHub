"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { useToast } from "@/hooks/useToast";

interface ThaliItem { id: string; itemName: string; sortOrder: number }
interface Thali {
  id: string; name: string; price: number; description?: string | null;
  maxSabjiCount: number; items: ThaliItem[];
}

interface ThaliModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  thali?: Thali | null;
}

const sabjiOptions = [
  { value: "0", label: "0 — No sabji choice (fixed items only)" },
  { value: "1", label: "1 — Pick 1 sabji" },
  { value: "2", label: "2 — Pick 2 sabji" },
];

export default function ThaliModal({ isOpen, onClose, onSuccess, thali }: ThaliModalProps) {
  const toast = useToast();
  const isEdit = !!thali;

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [maxSabjiCount, setMaxSabjiCount] = useState("1");
  const [items, setItems] = useState<string[]>([""]);
  const [newItem, setNewItem] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setName(thali?.name ?? "");
      setPrice(thali?.price?.toString() ?? "");
      setDescription(thali?.description ?? "");
      setMaxSabjiCount((thali?.maxSabjiCount ?? 1).toString());
      setItems(thali?.items?.map((i) => i.itemName) ?? [""]);
      setNewItem("");
      setErrors({});
    }
  }, [isOpen, thali]);

  const addItem = () => {
    if (newItem.trim()) {
      setItems((prev) => [...prev.filter(Boolean), newItem.trim()]);
      setNewItem("");
    }
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Name is required";
    if (!price || isNaN(Number(price)) || Number(price) <= 0) errs.price = "Valid price is required";
    if (items.filter(Boolean).length === 0) errs.items = "At least one fixed item is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const onSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const url = isEdit ? `/api/thalis/${thali.id}` : "/api/thalis";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          price: Number(price),
          description: description.trim() || null,
          maxSabjiCount: Number(maxSabjiCount),
          items: items.filter(Boolean),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      toast.success(isEdit ? "Thali updated!" : "Thali created!");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Thali" : "Add Thali"}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button variant="primary" onClick={onSubmit} isLoading={isSubmitting}>
            {isEdit ? "Save Changes" : "Save Thali"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Thali Name" placeholder="e.g. Small Gujarati Thali" required value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Price (₹)" type="number" min="0" placeholder="e.g. 80" required value={price} onChange={(e) => setPrice(e.target.value)} error={errors.price} />
          <Select label="Max Sabji Choice" required options={sabjiOptions} value={maxSabjiCount} onChange={(e) => setMaxSabjiCount(e.target.value)} />
        </div>
        <Input label="Description" placeholder="e.g. 4 Roti, 1 Subji, Salad (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />

        {/* Fixed items */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            Fixed Items <span className="text-red-500">*</span>
            <span className="text-gray-400 font-normal ml-1 text-xs">(always included — not sabji)</span>
          </p>
          <div className="space-y-1.5 mb-2">
            {items.filter(Boolean).map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                <span className="flex-1 text-sm text-gray-800">{item}</span>
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          {errors.items && <p className="text-xs text-red-500 mb-2">{errors.items}</p>}
          <div className="flex gap-2">
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem())}
              placeholder="e.g. 4 Roti, Dal, Rice..."
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
            />
            <Button type="button" variant="secondary" size="sm" onClick={addItem} leftIcon={<Plus size={14} />}>
              Add
            </Button>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <p className="text-xs text-amber-700">
            💡 Sabji options are set daily via the <strong>Daily Menu</strong> section — not here.
          </p>
        </div>
      </div>
    </Modal>
  );
}
