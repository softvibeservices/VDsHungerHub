// src\components\modals\UserModal.tsx

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
import { MapPin, Lock, Building2, Home } from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  number: z.string().regex(/^\d{10}$/, "Must be a 10-digit number"),
  companyId: z.string().min(1, "Company is required"),
  
  // Standardized Work Address fields
  workLine1: z.string().optional(),
  workLine2: z.string().optional(),
  workLandmark: z.string().optional(),

  // Standardized Home Address fields
  homeLine1: z.string().optional(),
  homeLine2: z.string().optional(),
  homeLandmark: z.string().optional(),

  // Coordinates: optional strings — parsed as floats on submission
  latitude: z.string().optional(),
  longitude: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Company { id: string; name: string; address?: string | null }
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

export default function UserModal({ isOpen, onClose, onSuccess, user, companies }: UserModalProps) {
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCoords, setShowCoords] = useState(false);
  const isEdit = !!user;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const selectedCompanyId = watch("companyId");
  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);
  const workAddressLocked = !!selectedCompany?.address && selectedCompany.address.trim().length >= 5;

  useEffect(() => {
    if (isOpen) {
      setShowCoords(!!(user?.latitude || user?.longitude));
      const parsedWork = parseAddressParts(user?.workAddress);
      const parsedHome = parseAddressParts(user?.homeAddress);

      reset({
        name: user?.name ?? "",
        number: user?.number ?? "",
        companyId: user?.companyId ?? "",
        workLine1: parsedWork.line1,
        workLine2: parsedWork.line2,
        workLandmark: parsedWork.landmark,
        homeLine1: parsedHome.line1,
        homeLine2: parsedHome.line2,
        homeLandmark: parsedHome.landmark,
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

      const finalWorkAddress = workAddressLocked
        ? selectedCompany!.address!.trim()
        : combineAddressParts(data.workLine1, data.workLine2, data.workLandmark);

      const finalHomeAddress = combineAddressParts(data.homeLine1, data.homeLine2, data.homeLandmark);

      const payload: Record<string, unknown> = {
        name: data.name.trim(),
        number: data.number.trim(),
        companyId: data.companyId,
        workAddress: finalWorkAddress,
        homeAddress: finalHomeAddress,
      };

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

        {/* Work Address */}
        <div className="space-y-2 pt-1 border-t border-gray-100">
          <label className="block text-xs font-semibold text-gray-700 flex items-center gap-1.5">
            <Building2 size={13} className="text-orange-500" /> Work Address
          </label>

          {workAddressLocked ? (
            <div className="w-full px-3.5 py-2.5 border border-orange-200 bg-orange-50/60 rounded-xl text-xs text-gray-800 font-medium flex items-start gap-2">
              <Lock size={14} className="text-orange-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-gray-900">{selectedCompany!.address}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">Auto-filled &amp; locked from selected company address</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Input placeholder="Address line 1 (Required)" error={errors.workLine1?.message} {...register("workLine1")} />
              <Input placeholder="Floor / Building (optional)" error={errors.workLine2?.message} {...register("workLine2")} />
              <Input placeholder="Landmark (optional)" error={errors.workLandmark?.message} {...register("workLandmark")} />
              {selectedCompanyId && (
                <p className="text-[10px] text-gray-400">
                  This company has no saved address on file yet. Address entered above will be used.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Home Address */}
        <div className="space-y-2 pt-1 border-t border-gray-100">
          <label className="block text-xs font-semibold text-gray-700 flex items-center gap-1.5">
            <Home size={13} className="text-orange-500" /> Home Address (optional)
          </label>
          <Input placeholder="Address line 1 (optional)" error={errors.homeLine1?.message} {...register("homeLine1")} />
          <Input placeholder="Floor / Building (optional)" error={errors.homeLine2?.message} {...register("homeLine2")} />
          <Input placeholder="Landmark (optional)" error={errors.homeLandmark?.message} {...register("homeLandmark")} />
        </div>

        {/* Coordinates — admin only, for delivery staff navigation */}
        {isEdit && (
          <div className="border border-dashed border-gray-200 rounded-xl overflow-hidden mt-2">
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
