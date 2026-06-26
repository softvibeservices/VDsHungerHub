"use client";

import { useState } from "react";
import Papa from "papaparse";
import { Upload, Download, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";

interface ProductRow {
  name: string;
  nameGu?: string;
  quantity: string;
  price: string;
  valid: boolean;
  error?: string;
}

interface BulkProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BulkProductModal({ isOpen, onClose, onSuccess }: BulkProductModalProps) {
  const toast = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [csvText, setCsvText] = useState("");
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  const handleClose = () => {
    setStep(1);
    setCsvText("");
    setRows([]);
    onClose();
  };

  const downloadTemplate = () => {
    const csv = [
      "name,nameGu,quantity,price",
      "Palak Paneer,પાલક પનીર,1 bowl,50",
      "Aloo Gobi,આલુ ગોબી,1 bowl,25",
      "Mix Veg,મિક્સ વેજ,1 bowl,30",
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "products_template.csv";
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

    const result = Papa.parse<{ name: string; nameGu?: string; quantity: string; price: string }>(
      csvText.trim(),
      { header: true, skipEmptyLines: true }
    );

    const headers = result.meta.fields ?? [];
    const required = ["name", "quantity", "price"];
    const missing = required.filter((h) => !headers.includes(h));
    if (missing.length > 0) {
      toast.error(`CSV missing required columns: ${missing.join(", ")}`);
      return;
    }

    if (result.data.length > 200) {
      toast.error("Maximum 200 products per import. Split into smaller files.");
      return;
    }

    const seen = new Set<string>();
    const validated: ProductRow[] = result.data.map((row) => {
      const name = row.name?.trim();
      const nameGu = row.nameGu?.trim() || undefined;
      const quantity = row.quantity?.trim();
      const price = row.price?.toString().trim();

      if (!name) return { name: "", nameGu, quantity: "", price: "", valid: false, error: "Name is empty" };
      if (!quantity) return { name, nameGu, quantity: "", price, valid: false, error: "Quantity is empty" };

      const priceNum = parseFloat(price);
      if (isNaN(priceNum) || priceNum < 0) {
        return { name, nameGu, quantity, price, valid: false, error: `Invalid price: "${price}"` };
      }

      if (seen.has(name.toLowerCase())) {
        return { name, nameGu, quantity, price, valid: false, error: `Duplicate name in CSV: "${name}"` };
      }
      seen.add(name.toLowerCase());

      return { name, nameGu, quantity, price, valid: true };
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
      const res = await fetch("/api/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          products: validRows.map((r) => ({
            name: r.name,
            nameGu: r.nameGu,
            quantity: r.quantity,
            price: parseFloat(r.price),
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Import failed");
      toast.success(
        `Import complete: ${json.created} created, ${json.updated} updated, ${json.skipped} skipped`
      );
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
      title="Bulk Upload Products"
      size="lg"
      footer={
        <>
          {step === 1 ? (
            <>
              <Button variant="secondary" onClick={handleClose}>Cancel</Button>
              <Button variant="primary" onClick={parseAndValidate} disabled={!csvText.trim()}>
                Validate CSV
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setStep(1)}>← Back</Button>
              <Button
                variant="primary"
                onClick={handleImport}
                isLoading={isImporting}
                disabled={validCount === 0}
              >
                Import {validCount} Valid Row{validCount !== 1 ? "s" : ""}
              </Button>
            </>
          )}
        </>
      }
    >
      {step === 1 && (
        <div className="space-y-4">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 space-y-1">
            <p className="font-semibold">Required CSV columns:</p>
            <p><code className="bg-blue-100 px-1 rounded">name</code> (required) — English product name</p>
            <p><code className="bg-blue-100 px-1 rounded">quantity</code> (required) — e.g. &quot;1 bowl&quot;, &quot;250ml&quot;</p>
            <p><code className="bg-blue-100 px-1 rounded">price</code> (required) — number in ₹, e.g. 50</p>
            <p><code className="bg-blue-100 px-1 rounded">nameGu</code> (optional) — Gujarati name</p>
          </div>

          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 text-xs text-orange-500 hover:text-orange-600 font-medium"
          >
            <Download size={13} /> Download Sample CSV Template
          </button>

          {/* File upload */}
          <label className="flex items-center gap-2 cursor-pointer px-3 py-2 border border-dashed border-gray-300 rounded-xl text-xs text-gray-500 hover:border-orange-400 hover:text-orange-600 transition-colors">
            <Upload size={14} />
            Upload .csv file
            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
          </label>

          {/* Or paste */}
          <div>
            <p className="text-xs text-gray-500 mb-1">Or paste CSV content directly:</p>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={6}
              placeholder={"name,nameGu,quantity,price\nPalak Paneer,પાલક પનીર,1 bowl,50"}
              className="w-full text-xs font-mono border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-orange-500/30 resize-none"
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          {/* Summary bar */}
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-emerald-600 font-semibold">
              <CheckCircle2 size={13} /> {validCount} ready to import
            </span>
            {errorCount > 0 && (
              <span className="flex items-center gap-1 text-red-500 font-semibold">
                <XCircle size={13} /> {errorCount} will be skipped
              </span>
            )}
          </div>

          {errorCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex gap-2 text-xs text-amber-700">
              <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
              Rows with errors will be skipped. Fix the CSV and re-upload to include them.
            </div>
          )}

          {/* Row-by-row preview */}
          <div className="max-h-72 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
            {rows.map((row, i) => (
              <div
                key={i}
                className={`flex items-start gap-2.5 px-3 py-2.5 text-xs ${
                  row.valid ? "bg-white" : "bg-red-50"
                }`}
              >
                {row.valid
                  ? <CheckCircle2 size={13} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                  : <XCircle size={13} className="text-red-400 mt-0.5 flex-shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-800">{row.name || "(empty)"}</span>
                    {row.nameGu && <span className="text-gray-400">{row.nameGu}</span>}
                    {row.quantity && <span className="text-gray-500">· {row.quantity}</span>}
                    {row.price && <span className="text-orange-600 font-medium">· ₹{row.price}</span>}
                  </div>
                  {row.error && (
                    <p className="text-red-500 mt-0.5">{row.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
