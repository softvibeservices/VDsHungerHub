"use client";

import { useEffect, useState } from "react";
import { useForm, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useToast } from "@/hooks/useToast";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  quantity: z.string().min(1, "Quantity is required"),
  price: z.coerce.number().min(0, "Price must be 0 or more"),
});
type FormData = z.infer<typeof schema>;

interface Product { id: string; name: string; quantity: string; price: number }

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product?: Product | null;
}

export default function ProductModal({ isOpen, onClose, onSuccess, product }: ProductModalProps) {
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEdit = !!product;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) as unknown as Resolver<FormData> });

  useEffect(() => {
    if (isOpen) {
      reset({ name: product?.name ?? "", quantity: product?.quantity ?? "", price: product?.price ?? 0 });
    }
  }, [isOpen, product, reset]);

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const url = isEdit ? `/api/products/${product.id}` : "/api/products";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
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
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit(onSubmit)} isLoading={isSubmitting}>
            {isEdit ? "Save Changes" : "Add Product"}
          </Button>
        </>
      }
    >
      <p className="text-xs text-gray-500 mb-4 bg-blue-50 px-3 py-2 rounded-lg border border-blue-100">
        Products are individual items (sabji, dal, roti, etc.) used to build thalis.
      </p>
      <div className="space-y-4">
        <Input label="Item Name" placeholder="e.g. Palak Paneer" required error={errors.name?.message} {...register("name")} />
        <Input label="Quantity" placeholder="e.g. 1 bowl, 250ml, 4 pieces" required error={errors.quantity?.message} {...register("quantity")} />
        <Input label="Price (₹)" type="number" min="0" step="0.5" required error={errors.price?.message} {...register("price")} />
      </div>
    </Modal>
  );
}
