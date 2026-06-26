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
  id: string;
  name: string;
  nameGu?: string | null;
  price: number;
  description?: string | null;
  sabjiCount: number;
  categoryId?: string | null;
  items: ThaliItem[];
}

interface ThaliModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  thali?: Thali | null;
}

const sabjiCountOptions = [
  { value: "0", label: "0 — No sabji" },
  { value: "1", label: "1 — One sabji" },
  { value: "2", label: "2 — Two sabjis" },
  { value: "3", label: "3 — Three sabjis" },
];

export default function ThaliModal({ isOpen, onClose, onSuccess, thali }: ThaliModalProps) {
  const toast = useToast();
  const isEdit = !!thali;

  const [name, setName] = useState("");
  const [nameGu, setNameGu] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [sabjiCount, setSabjiCount] = useState("1");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [items, setItems] = useState<string[]>([""]);
  const [newItem, setNewItem] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setName(thali?.name ?? "");
      setNameGu(thali?.nameGu ?? "");
      setPrice(thali?.price?.toString() ?? "");
      setDescription(thali?.description ?? "");
      setSabjiCount((thali?.sabjiCount ?? 1).toString());
      setCategoryId(thali?.categoryId ?? "");
      setItems(thali?.items?.map((i) => i.itemName) ?? [""]);
      setNewItem("");
      setErrors({});

      // Fetch active categories
      fetch("/api/thali-categories?isActive=true")
        .then((r) => r.json())
        .then((j) => setCategories((j.categories ?? []).map((c: any) => ({ id: c.id, name: c.name }))));
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
          nameGu: nameGu.trim() || null,
          price: Number(price),
          description: description.trim() || null,
          sabjiCount: Number(sabjiCount),
          categoryId: categoryId || null,
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
        <Input label="નામ (Gujarati Name)" placeholder="દા.ત. નાની ગુજરાતી થાળી" value={nameGu} onChange={(e) => setNameGu(e.target.value)} />
        <div className="grid grid-cols-3 gap-3">
          <Input label="Price (₹)" type="number" min="0" placeholder="e.g. 80" required value={price} onChange={(e) => setPrice(e.target.value)} error={errors.price} />
          
          <div className="space-y-1">
            <Select
              label="Category"
              options={[{ value: "", label: "— Uncategorized —" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Select label="Sabji Count" required options={sabjiCountOptions} value={sabjiCount} onChange={(e) => setSabjiCount(e.target.value)} />
          </div>
        </div>
        <div className="text-[11px] text-gray-400 flex justify-between gap-3 -mt-2.5 px-0.5">
          <span className="w-1/3"></span>
          <span className="w-1/3">Thalis in same category share one sabji picker.</span>
          <span className="w-1/3">Exact count of sabjis included with this thali.</span>
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

        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <p className="text-xs text-blue-700">
            💡 Fixed items are always included. Sabji options are chosen by the admin at daily menu creation time — no need to configure them here.
          </p>
        </div>
      </div>
    </Modal>
  );
}
