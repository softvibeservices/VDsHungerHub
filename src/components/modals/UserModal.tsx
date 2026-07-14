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
import { MapPin } from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  number: z.string().regex(/^\d{10}$/, "Must be a 10-digit number"),
  companyId: z.string().min(1, "Company is required"),
  workAddress: z.string().optional(),
  homeAddress: z.string().optional(),
  // Coordinates: optional strings — parsed as floats on submission
  latitude: z.string().optional(),
  longitude: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Company { id: string; name: string }
interface User {
  id: string;
  name: string;
  number: string;
  companyId: string;
  workAddress?: string | null;
  homeAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

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
  const [showCoords, setShowCoords] = useState(false);
  const isEdit = !!user;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (isOpen) {
      setShowCoords(!!(user?.latitude || user?.longitude));
      reset({
        name: user?.name ?? "",
        number: user?.number ?? "",
        companyId: user?.companyId ?? "",
        workAddress: user?.workAddress ?? "",
        homeAddress: user?.homeAddress ?? "",
        latitude: user?.latitude != null ? String(user.latitude) : "",
        longitude: user?.longitude != null ? String(user.longitude) : "",
      });
    }
  }, [isOpen, user, reset]);

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const url = isEdit ? `/api/users/${user.id}` : "/api/users";
      const method = isEdit ? "PUT" : "POST";

      const payload: Record<string, unknown> = {
        name: data.name,
        number: data.number,
        companyId: data.companyId,
        workAddress: data.workAddress?.trim() || null,
        homeAddress: data.homeAddress?.trim() || null,
      };

      // Only include coordinates on edit (admins set these for delivery nav)
      if (isEdit) {
        payload.latitude = data.latitude?.trim() ? parseFloat(data.latitude) : null;
        payload.longitude = data.longitude?.trim() ? parseFloat(data.longitude) : null;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
        {/* Core identity */}
        <Input label="Full Name" placeholder="e.g. Rahul Patel" required error={errors.name?.message} {...register("name")} />
        <Input label="Mobile Number" placeholder="10-digit number" required leftAddon="+91" error={errors.number?.message} {...register("number")} />
        <Select label="Company" placeholder="Select company" required options={companyOptions} error={errors.companyId?.message} {...register("companyId")} />

        {/* Addresses */}
        <Input
          label="Work Address"
          placeholder="Office / delivery address"
          error={errors.workAddress?.message}
          {...register("workAddress")}
        />
        <Input
          label="Home Address"
          placeholder="Home address (optional)"
          error={errors.homeAddress?.message}
          {...register("homeAddress")}
        />

        {/* Coordinates — admin only, for delivery staff navigation (Req #13) */}
        {isEdit && (
          <div className="border border-dashed border-gray-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowCoords((v) => !v)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors text-left"
            >
              <MapPin size={13} className="text-orange-400 flex-shrink-0" />
              Admin Only — Location Coordinates
              <span className="ml-auto text-gray-400">{showCoords ? "▲" : "▼"}</span>
            </button>

            {showCoords && (
              <div className="px-3 pb-3 pt-1 space-y-3 bg-amber-50/40">
                <p className="text-[10px] text-amber-700 bg-amber-100 rounded-lg px-2 py-1.5 leading-relaxed">
                  These coordinates are used by delivery staff only and are never shown to the customer.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Latitude"
                    placeholder="e.g. 23.0225"
                    error={errors.latitude?.message}
                    {...register("latitude")}
                  />
                  <Input
                    label="Longitude"
                    placeholder="e.g. 72.5714"
                    error={errors.longitude?.message}
                    {...register("longitude")}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
