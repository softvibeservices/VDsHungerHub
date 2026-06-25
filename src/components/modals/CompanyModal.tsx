"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useToast } from "@/hooks/useToast";

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  location: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface Company {
  id: string;
  name: string;
  location?: string | null;
}

interface CompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  company?: Company | null;
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
      reset({ name: company?.name ?? "", location: company?.location ?? "" });
    }
  }, [isOpen, company, reset]);

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const url = isEdit ? `/api/companies/${company.id}` : "/api/companies";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
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
        <Input
          label="Location"
          placeholder="e.g. Satellite, Ahmedabad (optional)"
          error={errors.location?.message}
          {...register("location")}
        />
      </div>
    </Modal>
  );
}
