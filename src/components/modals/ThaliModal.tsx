"use client";

import { useEffect, useState } from "react";
import { Plus, X, CheckSquare, Square } from "lucide-react";
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
  maxSabjiCount: number;
  items: ThaliItem[];
  sabjiPool?: { productId: string }[];
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
  { value: "3", label: "3 — Pick 3 sabji" },
];

export default function ThaliModal({ isOpen, onClose, onSuccess, thali }: ThaliModalProps) {
  const toast = useToast();
  const isEdit = !!thali;

  const [name, setName] = useState("");
  const [nameGu, setNameGu] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [maxSabjiCount, setMaxSabjiCount] = useState("1");
  const [items, setItems] = useState<string[]>([""]);
  const [newItem, setNewItem] = useState("");
  const [allProducts, setAllProducts] = useState<{ id: string; name: string; nameGu?: string | null }[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setName(thali?.name ?? "");
      setNameGu(thali?.nameGu ?? "");
      setPrice(thali?.price?.toString() ?? "");
      setDescription(thali?.description ?? "");
      setMaxSabjiCount((thali?.maxSabjiCount ?? 1).toString());
      setItems(thali?.items?.map((i) => i.itemName) ?? [""]);
      setNewItem("");
      setErrors({});

      const poolIds = thali?.sabjiPool?.map((p) => p.productId) ?? [];
      setSelectedProductIds(poolIds);

      fetch("/api/products?isActive=true")
        .then((res) => res.json())
        .then((data) => setAllProducts(data.products ?? []))
        .catch((err) => console.error("Error fetching active products:", err));
    }
  }, [isOpen, thali]);

  const toggleProduct = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

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
    
    const count = Number(maxSabjiCount);
    if (count > 0 && selectedProductIds.length < count) {
      errs.sabjiPool = `Select at least ${count} allowed sabji option(s)`;
    }

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
          maxSabjiCount: Number(maxSabjiCount),
          items: items.filter(Boolean),
          sabjiProductIds: Number(maxSabjiCount) > 0 ? selectedProductIds : [],
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
        <div className="grid grid-cols-2 gap-3">
          <Input label="Price (₹)" type="number" min="0" placeholder="e.g. 80" required value={price} onChange={(e) => setPrice(e.target.value)} error={errors.price} />
          <Select label="Max Sabji Choice" required options={sabjiOptions} value={maxSabjiCount} onChange={(e) => setMaxSabjiCount(e.target.value)} />
        </div>
        <Input label="Description" placeholder="e.g. 4 Roti, 1 Subji, Salad (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />

        {/* Sabji Pool selection */}
        {Number(maxSabjiCount) > 0 && (
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">
              Allowed Sabji Options <span className="text-red-500">*</span>
              <span className="text-xs text-gray-400 font-normal ml-2">
                (these products will be choosable at menu time)
              </span>
            </label>
            <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-3">
              {allProducts.map((product) => {
                const isSelected = selectedProductIds.includes(product.id);
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => toggleProduct(product.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs text-left transition-all ${
                      isSelected
                        ? "border-orange-400 bg-orange-50 text-orange-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {isSelected ? <CheckSquare size={14} className="text-orange-500 flex-shrink-0" /> : <Square size={14} className="text-gray-300 flex-shrink-0" />}
                    <div>
                      <p className="font-semibold">{product.name}</p>
                      {product.nameGu && <p className="text-[10px] text-gray-400">{product.nameGu}</p>}
                    </div>
                  </button>
                );
              })}
            </div>
            {errors.sabjiPool && <p className="text-xs text-red-500 mt-1">{errors.sabjiPool}</p>}
            {selectedProductIds.length < Number(maxSabjiCount) && (
              <p className="text-xs text-amber-600 mt-1">
                ⚠ Select at least {maxSabjiCount} product(s) to allow valid sabji choices
              </p>
            )}
          </div>
        )}

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
            💡 Fixed items are included by default. Sabji options must be configured in this pool first to be chosen during daily menus.
          </p>
        </div>
      </div>
    </Modal>
  );
}
