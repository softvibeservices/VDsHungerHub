"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { useToast } from "@/hooks/useToast";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  number: z.string().regex(/^\d{10}$/, "Must be a 10-digit number"),
  companyId: z.string().min(1, "Company is required"),
});
type FormData = z.infer<typeof schema>;

interface Company { id: string; name: string }
interface User { id: string; name: string; number: string; companyId: string }

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user?: User | null;
  companies: Company[];
}

export default function UserModal({ isOpen, onClose, onSuccess, user, companies }: UserModalProps) {
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEdit = !!user;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (isOpen) {
      reset({
        name: user?.name ?? "",
        number: user?.number ?? "",
        companyId: user?.companyId ?? "",
      });
    }
  }, [isOpen, user, reset]);

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const url = isEdit ? `/api/users/${user.id}` : "/api/users";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");

      toast.success(isEdit ? "User updated!" : "User added!");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const companyOptions = companies.map((c) => ({ value: c.id, label: c.name }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit User" : "Add User"}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit(onSubmit)} isLoading={isSubmitting}>
            {isEdit ? "Save Changes" : "Add User"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Full Name" placeholder="e.g. Rahul Patel" required error={errors.name?.message} {...register("name")} />
        <Input label="Mobile Number" placeholder="10-digit number" required leftAddon="+91" error={errors.number?.message} {...register("number")} />
        <Select label="Company" placeholder="Select company" required options={companyOptions} error={errors.companyId?.message} {...register("companyId")} />
      </div>
    </Modal>
  );
}
