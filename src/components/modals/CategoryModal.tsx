"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useToast } from "@/hooks/useToast";

interface CategoryThali {
  id: string;
  name: string;
  nameGu?: string | null;
}

interface Category {
  id: string;
  name: string;
  nameGu?: string | null;
  thalis: CategoryThali[];
}

interface AllThali {
  id: string;
  name: string;
  nameGu?: string | null;
  categoryId?: string | null;
}

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  category?: Category | null;
}

export default function CategoryModal({ isOpen, onClose, onSuccess, category }: CategoryModalProps) {
  const toast = useToast();
  const isEdit = !!category;

  const [name, setName] = useState("");
  const [nameGu, setNameGu] = useState("");
  const [allThalis, setAllThalis] = useState<AllThali[]>([]);
  const [selectedThaliIds, setSelectedThaliIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    setName(category?.name ?? "");
    setNameGu(category?.nameGu ?? "");
    setSelectedThaliIds(category?.thalis?.map((t) => t.id) ?? []);
    setErrors({});

    // Load all thalis so we can show "already in another category" hints
    fetch("/api/thalis")
      .then((r) => r.json())
      .then((j) => setAllThalis(j.thalis ?? []));
  }, [isOpen, category]);

  const toggleThali = (id: string) => {
    setSelectedThaliIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Category name is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const onSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const url = isEdit ? `/api/thali-categories/${category.id}` : "/api/thali-categories";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          nameGu: nameGu.trim() || null,
          thaliIds: selectedThaliIds,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      toast.success(isEdit ? "Category updated!" : "Category created!");
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
      title={isEdit ? "Edit Category" : "Add Category"}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSubmit} isLoading={isSubmitting}>
            {isEdit ? "Save Changes" : "Save Category"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Category Name"
          placeholder="e.g. Gujarati Thali"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />
        <Input
          label="નામ (Gujarati Name)"
          placeholder="દા.ત. ગુજરાતી થાળી"
          value={nameGu}
          onChange={(e) => setNameGu(e.target.value)}
        />

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            Assign Thalis <span className="text-gray-400 font-normal text-xs">(a thali belongs to one category at a time)</span>
          </p>
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 border border-gray-150 rounded-xl p-2">
            {allThalis.length === 0 && <p className="text-xs text-gray-400 italic p-2">No thalis created yet.</p>}
            {allThalis.map((t) => {
              const isChecked = selectedThaliIds.includes(t.id);
              const belongsElsewhere = t.categoryId && t.categoryId !== category?.id;
              return (
                <label
                  key={t.id}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleThali(t.id)}
                    className="rounded text-orange-500 focus:ring-orange-500 border-gray-300"
                  />
                  <span className="text-sm text-gray-800 flex-1">{t.name}</span>
                  {belongsElsewhere && !isChecked && (
                    <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-150">
                      In another category
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <p className="text-xs text-blue-700">
            💡 Checking a thali here moves it into this category, even if it was previously in another one.
          </p>
        </div>
      </div>
    </Modal>
  );
}
