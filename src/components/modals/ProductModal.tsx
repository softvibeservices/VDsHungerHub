"use client";

import { useEffect, useState } from "react";
import { useForm, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, X, Package } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useToast } from "@/hooks/useToast";

// ─── Zod schema ────────────────────────────────────────────────────────────────
const schema = z.object({
  name: z.string().min(1, "Name is required"),
  nameGu: z.string().optional().nullable().transform((val) => val || null),
  quantity: z.string().min(1, "Quantity is required"),
  price: z.coerce.number().min(0, "Price must be 0 or more"),
});
type FormData = z.infer<typeof schema>;

// ─── Types ─────────────────────────────────────────────────────────────────────
interface AddonItem {
  name: string;
  price: number;
}

interface Product {
  id: string;
  name: string;
  nameGu?: string | null;
  quantity: string;
  price: number;
  isAddOnAvailable?: boolean;
  addOns?: AddonItem[];
}

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product?: Product | null;
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function ProductModal({
  isOpen,
  onClose,
  onSuccess,
  product,
}: ProductModalProps) {
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEdit = !!product;

  // Add-On state (managed outside react-hook-form because it's a dynamic list)
  const [isAddOnAvailable, setIsAddOnAvailable] = useState(false);
  const [addOns, setAddOns] = useState<AddonItem[]>([]);
  const [newAddonName, setNewAddonName] = useState("");
  const [newAddonPrice, setNewAddonPrice] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as unknown as Resolver<FormData>,
  });

  // Populate form when modal opens
  useEffect(() => {
    if (isOpen) {
      reset({
        name: product?.name ?? "",
        nameGu: product?.nameGu ?? "",
        quantity: product?.quantity ?? "",
        price: product?.price ?? 0,
      });
      setIsAddOnAvailable(product?.isAddOnAvailable ?? false);
      setAddOns(product?.addOns?.map((a) => ({ name: a.name, price: a.price })) ?? []);
      setNewAddonName("");
      setNewAddonPrice("");
    }
  }, [isOpen, product, reset]);

  // Add a new add-on to the local list
  const handleAddAddon = () => {
    const trimmedName = newAddonName.trim();
    if (!trimmedName) {
      toast.error("Add-on name cannot be empty");
      return;
    }
    if (addOns.some((a) => a.name.toLowerCase() === trimmedName.toLowerCase())) {
      toast.error(`"${trimmedName}" is already in the list`);
      return;
    }
    setAddOns((prev) => [
      ...prev,
      { name: trimmedName, price: Number(newAddonPrice) || 0 },
    ]);
    setNewAddonName("");
    setNewAddonPrice("");
  };

  const handleAddonKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddAddon();
    }
  };

  const removeAddon = (index: number) => {
    setAddOns((prev) => prev.filter((_, i) => i !== index));
  };

  const updateAddonPrice = (index: number, newPrice: string) => {
    setAddOns((prev) =>
      prev.map((a, i) => (i === index ? { ...a, price: Number(newPrice) || 0 } : a))
    );
  };

  // Submit handler
  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const url = isEdit ? `/api/products/${product.id}` : "/api/products";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          isAddOnAvailable,
          addOns: isAddOnAvailable ? addOns : [],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      toast.success(isEdit ? "Product updated!" : "Product added!");
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
      title={isEdit ? "Edit Product" : "Add Product"}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit(onSubmit)}
            isLoading={isSubmitting}
          >
            {isEdit ? "Save Changes" : "Add Product"}
          </Button>
        </>
      }
    >
      {/* ── Info banner ───────────────────────────────────────────────── */}
      <p className="text-xs text-gray-500 mb-4 bg-blue-50 px-3 py-2 rounded-lg border border-blue-100">
        Products are individual sabji / items used in thalis and daily menus.
      </p>

      <div className="space-y-4">
        {/* ── Core fields ───────────────────────────────────────────────── */}
        <Input
          label="Item Name"
          placeholder="e.g. Palak Paneer"
          required
          error={errors.name?.message}
          {...register("name")}
        />
        <Input
          label="નામ (Gujarati Name)"
          placeholder="દા.ત. પાલક પનીર"
          error={errors.nameGu?.message}
          {...register("nameGu")}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Quantity"
            placeholder="e.g. 1 bowl, 4 pcs"
            required
            error={errors.quantity?.message}
            {...register("quantity")}
          />
          <Input
            label="Price (₹)"
            type="number"
            min="0"
            step="0.5"
            required
            error={errors.price?.message}
            {...register("price")}
          />
        </div>

        {/* ── Divider ───────────────────────────────────────────────────── */}
        <div className="border-t border-gray-100 pt-4">

          {/* Toggle: Product Available for Add-On */}
          <button
            type="button"
            onClick={() => setIsAddOnAvailable((v) => !v)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all cursor-pointer ${
              isAddOnAvailable
                ? "border-orange-400 bg-orange-50"
                : "border-gray-200 bg-gray-50 hover:border-gray-300"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Package
                size={16}
                className={isAddOnAvailable ? "text-orange-500" : "text-gray-400"}
              />
              <div className="text-left">
                <p
                  className={`text-sm font-semibold ${
                    isAddOnAvailable ? "text-orange-700" : "text-gray-700"
                  }`}
                >
                  Product Available for Add-On
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Enable to list extras customers can add with this item
                </p>
              </div>
            </div>
            {/* Toggle pill */}
            <div
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                isAddOnAvailable ? "bg-orange-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  isAddOnAvailable ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </div>
          </button>

          {/* Add-On items section (only shown when toggle is ON) */}
          {isAddOnAvailable && (
            <div className="mt-3 space-y-3 bg-orange-50/60 border border-orange-100 rounded-xl p-3.5">

              {/* Section label */}
              <p className="text-xs font-bold text-orange-700 uppercase tracking-wider">
                Add-On Items
              </p>

              {/* Existing add-ons list */}
              {addOns.length > 0 && (
                <div className="space-y-1.5">
                  {addOns.map((addon, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 bg-white border border-orange-200 rounded-lg px-2.5 py-1.5"
                    >
                      <span className="flex-1 text-sm font-medium text-gray-800 truncate">
                        {addon.name}
                      </span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-xs text-gray-400">₹</span>
                        <input
                          type="number"
                          value={addon.price}
                          onChange={(e) => updateAddonPrice(idx, e.target.value)}
                          min="0"
                          step="0.5"
                          className="w-16 text-xs text-right border border-gray-200 rounded-md px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAddon(idx)}
                        className="p-0.5 text-gray-300 hover:text-red-400 transition-colors cursor-pointer flex-shrink-0"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* New add-on input row */}
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase">
                    Item Name
                  </label>
                  <input
                    type="text"
                    value={newAddonName}
                    onChange={(e) => setNewAddonName(e.target.value)}
                    onKeyDown={handleAddonKeyDown}
                    placeholder="e.g. Roti, Buttermilk, Shreekhnd, Jaggery"
                    className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 bg-white"
                  />
                </div>
                <div className="w-20">
                  <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase">
                    Price ₹
                  </label>
                  <input
                    type="number"
                    value={newAddonPrice}
                    onChange={(e) => setNewAddonPrice(e.target.value)}
                    onKeyDown={handleAddonKeyDown}
                    placeholder="0"
                    min="0"
                    step="0.5"
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 bg-white text-right"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddAddon}
                  className="flex items-center gap-1 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer flex-shrink-0"
                >
                  <Plus size={13} />
                  Add
                </button>
              </div>

              {addOns.length === 0 && (
                <p className="text-[11px] text-gray-400 text-center py-1 italic">
                  No add-ons yet — type a name above and click Add
                </p>
              )}

              <p className="text-[10px] text-gray-400">
                {addOns.length} add-on{addOns.length !== 1 ? "s" : ""} configured ·
                Press Enter or click Add to add each item
              </p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
