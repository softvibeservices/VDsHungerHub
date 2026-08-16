// src\components\modals\CompanyModal.tsx

"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useToast } from "@/hooks/useToast";
import { Building2 } from "lucide-react";

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  
  // Standardized 3-field address structure (matches registration & profile forms)
  line1: z.string().optional(),
  line2: z.string().optional(),
  landmark: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Company {
  id: string;
  name: string;
  location?: string | null;
  address?: string | null;
}

interface CompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  company?: Company | null;
}

function parseAddressParts(raw: string | null | undefined): { line1: string; line2: string; landmark: string } {
  if (!raw || !raw.trim()) return { line1: "", line2: "", landmark: "" };
  const parts = raw.split(",").map((p) => p.trim());
  return {
    line1: parts[0] ?? "",
    line2: parts[1] ?? "",
    landmark: parts[2] ?? "",
  };
}

function combineAddressParts(line1?: string, line2?: string, landmark?: string): string | null {
  const parts = [line1?.trim(), line2?.trim(), landmark?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

export default function CompanyModal({ isOpen, onClose, onSuccess, company }: CompanyModalProps) {
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEdit = !!company;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (isOpen) {
      const rawAddress = company?.address || company?.location;
      const parsedAddr = parseAddressParts(rawAddress);
      reset({
        name: company?.name ?? "",
        line1: parsedAddr.line1,
        line2: parsedAddr.line2,
        landmark: parsedAddr.landmark,
      });
    }
  }, [isOpen, company, reset]);

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const url = isEdit ? `/api/companies/${company.id}` : "/api/companies";
      const method = isEdit ? "PUT" : "POST";

      const formattedAddress = combineAddressParts(data.line1, data.line2, data.landmark);

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name.trim(),
          location: data.line1?.trim() || formattedAddress || null,
          address: formattedAddress,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");

      toast.success(isEdit ? "Company updated!" : "Company added!");
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
      title={isEdit ? "Edit Company" : "Add Company"}
      size="sm"
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
            {isEdit ? "Save Changes" : "Add Company"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Company Name"
          placeholder="e.g. TechCorp Pvt Ltd"
          required
          error={errors.name?.message}
          {...register("name")}
        />

        {/* Standardized 3-Field Delivery Address (Identical to Customer Registration) */}
        <div className="space-y-2 pt-1 border-t border-gray-100">
          <label className="block text-xs font-semibold text-gray-700 flex items-center gap-1.5">
            <Building2 size={13} className="text-orange-500" /> Company Delivery Address
          </label>
          <Input
            placeholder="Address line 1 (Required for auto-lock)"
            error={errors.line1?.message}
            {...register("line1")}
          />
          <Input
            placeholder="Floor / Building (optional)"
            error={errors.line2?.message}
            {...register("line2")}
          />
          <Input
            placeholder="Landmark (optional)"
            error={errors.landmark?.message}
            {...register("landmark")}
          />
          <p className="text-[10px] text-gray-400">
            This delivery address will be automatically fetched and locked for all employees of this company.
          </p>
        </div>
      </div>
    </Modal>
  );
}
