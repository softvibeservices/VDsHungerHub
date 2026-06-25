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
  name: z.string().min(1, "Name is required"),
  number: z.string().regex(/^\d{10}$/, "Must be a 10-digit number"),
});
type FormData = z.infer<typeof schema>;

interface Staff { id: string; name: string; number: string }

interface StaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  staff?: Staff | null;
}

export default function StaffModal({ isOpen, onClose, onSuccess, staff }: StaffModalProps) {
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEdit = !!staff;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (isOpen) reset({ name: staff?.name ?? "", number: staff?.number ?? "" });
  }, [isOpen, staff, reset]);

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const url = isEdit ? `/api/staff/${staff.id}` : "/api/staff";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      toast.success(isEdit ? "Staff updated!" : "Staff member added!");
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
      title={isEdit ? "Edit Staff" : "Add Staff Member"}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit(onSubmit)} isLoading={isSubmitting}>
            {isEdit ? "Save Changes" : "Add Staff"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Full Name" placeholder="e.g. Ramesh (Delivery)" required error={errors.name?.message} {...register("name")} />
        <Input label="Mobile Number" placeholder="10-digit number" required leftAddon="+91" error={errors.number?.message} {...register("number")} />
      </div>
    </Modal>
  );
}
