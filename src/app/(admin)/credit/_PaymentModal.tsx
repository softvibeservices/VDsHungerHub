"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { PaymentMethod } from "@/types";
import { formatCurrency, getErrorMessage } from "@/lib/utils";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: { id: string; name: string; balance: number };
  onPaymentSuccess: () => void;
}

export default function PaymentModal({
  isOpen,
  onClose,
  user,
  onPaymentSuccess,
}: PaymentModalProps) {
  const [amount, setAmount] = useState(user.balance > 0 ? user.balance.toString() : "");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Please enter a valid amount greater than 0");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/credit/${user.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: numAmount,
          method,
          note: note.trim() || undefined,
          paidAtUtc: new Date(date).toISOString(),
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to record payment");
      }

      onPaymentSuccess();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Record Payment — ${user.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {user.balance > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs text-orange-800">
            Current Outstanding Balance: <span className="font-bold">{formatCurrency(user.balance)}</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        <Input
          label="Amount Paid (₹)"
          type="number"
          step="any"
          min="0.01"
          placeholder="e.g. 500"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />

        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
            Payment Method
          </label>
          <Select
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            options={[
              { value: "CASH", label: "Cash" },
              { value: "UPI", label: "UPI" },
              { value: "BANK_TRANSFER", label: "Bank Transfer" },
              { value: "OTHER", label: "Other" },
            ]}
          />
        </div>

        <Input
          label="Date of Payment"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />

        <Input
          label="Notes / Reference (Optional)"
          type="text"
          placeholder="e.g. UPI ref #12345 or Cash handed to staff"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Save Payment
          </Button>
        </div>
      </form>
    </Modal>
  );
}
