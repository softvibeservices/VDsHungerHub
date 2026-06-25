"use client";

import Modal from "./Modal";
import Button from "./Button";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmLabel?: string;
  isLoading?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Delete",
  message,
  confirmLabel = "Delete",
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
          <AlertTriangle size={18} className="text-red-500" />
        </div>
        <p className="text-sm text-gray-600 leading-relaxed pt-2">{message}</p>
      </div>
    </Modal>
  );
}
