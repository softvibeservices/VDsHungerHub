"use client";

import { useState } from "react";
import Papa from "papaparse";
import { Upload, Download, CheckCircle2, XCircle } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";

interface BulkRow {
  name: string;
  number: string;
  company_name: string;
  valid: boolean;
  error?: string;
}

interface BulkUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BulkUserModal({ isOpen, onClose, onSuccess }: BulkUserModalProps) {
  const toast = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [csvText, setCsvText] = useState("");
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  const handleClose = () => {
    setStep(1);
    setCsvText("");
    setRows([]);
    onClose();
  };

  const downloadTemplate = () => {
    const csv = "name,number,company_name\nRahul Patel,9876543210,TechCorp Pvt Ltd\nPriya Shah,9988776655,Infosys BPO";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "users_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(ev.target?.result as string);
    reader.readAsText(file);
  };

  const parseAndValidate = () => {
    if (!csvText.trim()) {
      toast.error("Please paste CSV data or upload a file");
      return;
    }
    const result = Papa.parse<{ name: string; number: string; company_name: string }>(csvText.trim(), {
      header: true,
      skipEmptyLines: true,
    });

    const validated: BulkRow[] = result.data.map((row) => {
      const cleanNumber = row.number?.toString().replace(/\s+/g, "").replace(/^\+91/, "").replace(/^0/, "");
      if (!row.name?.trim()) return { ...row, valid: false, error: "Name is empty" };
      if (!cleanNumber || !/^\d{10}$/.test(cleanNumber)) return { ...row, valid: false, error: `Invalid number: "${row.number}"` };
      if (!row.company_name?.trim()) return { ...row, valid: false, error: "Company name is empty" };
      return { name: row.name.trim(), number: cleanNumber, company_name: row.company_name.trim(), valid: true };
    });

    setRows(validated);
    setStep(2);
  };

  const handleImport = async () => {
    const validRows = rows.filter((r) => r.valid);
    if (validRows.length === 0) {
      toast.error("No valid rows to import");
      return;
    }
    setIsImporting(true);
    try {
      const res = await fetch("/api/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users: validRows }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Import failed");
      toast.success(`Imported ${json.created} user(s)${json.skipped > 0 ? `, skipped ${json.skipped}` : ""}`);
      onSuccess();
      handleClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setIsImporting(false);
    }
  };

  const validCount = rows.filter((r) => r.valid).length;
  const errorCount = rows.filter((r) => !r.valid).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Bulk Import Users"
      size="lg"
      footer={
        step === 1 ? (
          <>
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
            <Button variant="primary" onClick={parseAndValidate}>Preview & Validate →</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setStep(1)}>← Back</Button>
            <Button variant="primary" onClick={handleImport} isLoading={isImporting} disabled={validCount === 0}>
              Import {validCount} Valid User{validCount !== 1 ? "s" : ""}
            </Button>
          </>
        )
      }
    >
      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm font-medium text-blue-800 mb-1">CSV Format</p>
            <code className="text-xs text-blue-700 block font-mono">name, number, company_name</code>
            <p className="text-xs text-blue-600 mt-1">Company name must exactly match an existing company.</p>
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" size="sm" leftIcon={<Download size={14} />} onClick={downloadTemplate}>
              Download Template
            </Button>
            <label className="cursor-pointer">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors">
                <Upload size={14} /> Upload .csv
              </span>
              <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-1.5">Or paste CSV data:</p>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={8}
              placeholder={"name,number,company_name\nRahul Patel,9876543210,TechCorp Pvt Ltd"}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 resize-y"
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <div className="flex gap-4 text-sm font-medium">
            <span className="text-emerald-600 flex items-center gap-1">
              <CheckCircle2 size={14} /> Valid: {validCount}
            </span>
            <span className="text-red-500 flex items-center gap-1">
              <XCircle size={14} /> Errors: {errorCount}
            </span>
          </div>
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {rows.map((row, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs ${
                  row.valid ? "bg-emerald-50 border border-emerald-100" : "bg-red-50 border border-red-100"
                }`}
              >
                {row.valid ? (
                  <CheckCircle2 size={13} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle size={13} className="text-red-500 mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <span className="font-medium">{row.name}</span>
                  {row.number && <span className="text-gray-500 ml-2">{row.number}</span>}
                  {row.company_name && <span className="text-gray-400 ml-2">— {row.company_name}</span>}
                  {row.error && <p className="text-red-600 mt-0.5">{row.error}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
