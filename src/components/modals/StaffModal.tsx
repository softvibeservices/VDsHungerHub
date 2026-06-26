"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useToast } from "@/hooks/useToast";

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  number: z.string().regex(/^\d{10}$/, "Must be a 10-digit number"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const editSchema = z.object({
  name: z.string().min(1, "Name is required"),
  number: z.string().regex(/^\d{10}$/, "Must be a 10-digit number"),
  password: z.string().optional(),
});

type CreateFormData = z.infer<typeof createSchema>;
type EditFormData = z.infer<typeof editSchema>;
type FormData = CreateFormData | EditFormData;

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
  } = useForm<FormData>({
    resolver: zodResolver(isEdit ? editSchema : createSchema),
  });

  useEffect(() => {
    if (isOpen) reset({ name: staff?.name ?? "", number: staff?.number ?? "", password: "" });
  }, [isOpen, staff, reset]);

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const url = isEdit ? `/api/staff/${staff.id}` : "/api/staff";
      const body: Record<string, unknown> = {
        name: data.name,
        number: data.number,
      };
      if (!isEdit && (data as CreateFormData).password) {
        body.password = (data as CreateFormData).password;
      }
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
        <Input
          label="Full Name"
          placeholder="e.g. Ramesh (Delivery)"
          required
          error={(errors as Record<string, { message?: string }>).name?.message}
          {...register("name")}
        />
        <Input
          label="Mobile Number"
          placeholder="10-digit number"
          required
          leftAddon="+91"
          error={(errors as Record<string, { message?: string }>).number?.message}
          {...register("number")}
        />
        {!isEdit && (
          <Input
            label="Password"
            type="password"
            placeholder="Min 6 characters (staff login password)"
            required
            error={(errors as Record<string, { message?: string }>).password?.message}
            {...register("password")}
          />
        )}
        {!isEdit && (
          <p className="text-xs text-gray-400">
            💡 Staff can log in at the same login page using their mobile number and this password.
          </p>
        )}
      </div>
    </Modal>
  );
}
