"use client";

import { useEffect, useState } from "react";
import { ToggleLeft, ToggleRight, Info } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useToast } from "@/hooks/useToast";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  name: string;
  nameGu?: string | null;
  quantity: string;
  price: number;
  isActive: boolean;
  isAddOnAvailable: boolean;
}

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product?: Product | null;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ProductModal({
  isOpen,
  onClose,
  onSuccess,
  product,
}: ProductModalProps) {
  const toast = useToast();
  const isEdit = !!product;

  // ── Form state ─────────────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [nameGu, setNameGu] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [isAddOnAvailable, setIsAddOnAvailable] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Reset when modal opens/changes ─────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setName(product?.name ?? "");
      setNameGu(product?.nameGu ?? "");
      setQuantity(product?.quantity ?? "");
      setPrice(product?.price?.toString() ?? "");
      setIsAddOnAvailable(product?.isAddOnAvailable ?? false);
      setErrors({});
    }
  }, [isOpen, product]);

  // ── Validation ─────────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!name.trim()) errs.name = "Product name is required";
    if (!quantity.trim()) errs.quantity = "Quantity is required";

    const parsedPrice = Number(price);
    if (!price || isNaN(parsedPrice) || parsedPrice < 0) {
      errs.price = "Valid price is required";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const onSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);

    try {
      const url = isEdit ? `/api/products/${product.id}` : "/api/products";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          nameGu: nameGu.trim() || null,
          quantity: quantity.trim(),
          price: Number(price),
          isAddOnAvailable,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");

      toast.success(isEdit ? "Product updated!" : "Product created!");
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
          <Button variant="primary" onClick={onSubmit} isLoading={isSubmitting}>
            {isEdit ? "Save Changes" : "Save Product"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Info banner */}
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 p-3 rounded-xl text-xs text-blue-755 leading-normal">
          <Info size={14} className="mt-0.5 flex-shrink-0" />
          <p>
            Products are raw items (like Roti, Sabji, Dal, or Sweet) used to build your Thalis and Daily Menu.
          </p>
        </div>

        {/* ── Name (English) ─────────────────────────────────────────────── */}
        <Input
          label="Product Name"
          placeholder="e.g. Palak Paneer"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />

        {/* ── Name (Gujarati) ────────────────────────────────────────────── */}
        <Input
          label="નામ (Gujarati Name)"
          placeholder="દા.ત. પાલક પનીર"
          value={nameGu}
          onChange={(e) => setNameGu(e.target.value)}
        />

        {/* ── Quantity + Price ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Quantity"
            placeholder="e.g. 1 bowl, 4 pcs"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            error={errors.quantity}
          />
          <Input
            label="Price (₹)"
            type="number"
            min="0"
            placeholder="e.g. 30"
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            error={errors.price}
          />
        </div>

        {/* ── Available for Add-On toggle ────────────────────────────────── */}
        <div className="flex items-center justify-between py-2.5 px-3.5 bg-gray-50 border border-gray-200 rounded-xl">
          <div>
            <p className="text-sm font-semibold text-gray-800">
              Available as Add-On
            </p>
            <p className="text-xs text-gray-500 mt-0.5 font-medium leading-normal">
              If enabled, customers can buy this product as an extra side-item with their order.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddOnAvailable((prev) => !prev)}
            className="flex-shrink-0 transition-colors cursor-pointer"
            aria-label="Toggle add-on availability"
          >
            {isAddOnAvailable ? (
              <ToggleRight size={32} className="text-orange-500 animate-fadeIn" />
            ) : (
              <ToggleLeft size={32} className="text-gray-300" />
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
