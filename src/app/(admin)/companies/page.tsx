"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, ShieldCheck, Clock, Check, AlertTriangle, AlertCircle } from "lucide-react";
import Table, { Column } from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import SearchInput from "@/components/ui/SearchInput";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Modal from "@/components/ui/Modal";
import CompanyModal from "@/components/modals/CompanyModal";
import { useToast } from "@/hooks/useToast";
import { useDebounce } from "@/hooks/useDebounce";
import { formatMobileNumber } from "@/lib/utils";

interface ReporterUser {
  id: string;
  name: string;
  number: string;
}

interface Company {
  id: string;
  name: string;
  location?: string | null;
  isActive: boolean;
  status: "PENDING" | "CONFIRMED";
  isVerifiedByAdmin: boolean;
  isFlaggedFake: boolean;
  flaggedReason?: string | null;
  confirmedAtUtc?: string | null;
  addedByUser?: ReporterUser | null;
  _count: { users: number };
}

export default function CompaniesPage() {
  const toast = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"verified" | "pending" | "flagged">("verified");
  const debouncedSearch = useDebounce(search, 300);

  const [modalOpen, setModalOpen] = useState(false);
  const [editCompany, setEditCompany] = useState<Company | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // States for verification / flag fake actions
  const [verifyCompany, setVerifyCompany] = useState<Company | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const [flagCompany, setFlagCompany] = useState<Company | null>(null);
  const [flagReason, setFlagReason] = useState("");
  const [alsoBlockReporter, setAlsoBlockReporter] = useState(false);
  const [isFlagging, setIsFlagging] = useState(false);

  const fetchCompanies = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ search: debouncedSearch, tab });
      const res = await fetch(`/api/companies?${params}`);
      const json = await res.json();
      setCompanies(json.companies ?? []);
      setTotal(json.total ?? 0);
    } catch {
      toast.error("Failed to load companies");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, tab]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/companies/${deleteId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      toast.success("Company deleted");
      setDeleteId(null);
      fetchCompanies();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleVerify = async () => {
    if (!verifyCompany) return;
    setIsVerifying(true);
    try {
      const res = await fetch(`/api/admin/companies/${verifyCompany.id}/verify`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Verification failed");
      toast.success("Company verified!");
      setVerifyCompany(null);
      fetchCompanies();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleFlagFake = async () => {
    if (!flagCompany) return;
    if (!flagReason.trim()) {
      toast.error("Flag reason is required");
      return;
    }
    setIsFlagging(true);
    try {
      const res = await fetch(`/api/admin/companies/${flagCompany.id}/flag-fake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: flagReason.trim(),
          alsoBlockReporter,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Flag action failed");
      toast.success(alsoBlockReporter ? "Company flagged as fake and reporter blocked!" : "Company flagged as fake!");
      setFlagCompany(null);
      setFlagReason("");
      setAlsoBlockReporter(false);
      fetchCompanies();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setIsFlagging(false);
    }
  };

  const columns: Column<Company>[] = [
    {
      key: "name",
      header: "Company Name",
      render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: "location",
      header: "Location",
      render: (row) => <span className="text-gray-500">{row.location || "—"}</span>,
    },
    {
      key: "users",
      header: "Users",
      render: (row) => <span className="text-gray-600">{row._count.users}</span>,
    },
    {
      key: "verificationStatus",
      header: "Verification",
      render: (row) => {
        if (row.isFlaggedFake) {
          return (
            <div className="flex flex-col gap-0.5">
              <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 border border-red-100 rounded-full px-2 py-0.5 font-medium">
                <AlertCircle size={11} /> Flagged Fake
              </span>
              {row.flaggedReason && (
                <span className="text-[10px] text-red-500 max-w-[200px] line-clamp-1">{row.flaggedReason}</span>
              )}
            </div>
          );
        }

        if (row.isVerifiedByAdmin) {
          return (
            <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-100 rounded-full px-2 py-0.5 font-medium">
              <ShieldCheck size={11} /> Verified
            </span>
          );
        }

        return (
          <div className="flex flex-col gap-1">
            <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5 font-medium">
              <Clock size={11} /> Pending Moderation
            </span>
            {row.addedByUser && (
              <span className="text-[10px] text-gray-400">
                Added by: {row.addedByUser.name} ({formatMobileNumber(row.addedByUser.number)})
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      width: "w-36",
      render: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setEditCompany(row); setModalOpen(true); }}
            className="p-1 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
            title="Edit company"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => setDeleteId(row.id)}
            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete company"
          >
            <Trash2 size={14} />
          </button>

          {/* Pending company moderation options */}
          {!row.isVerifiedByAdmin && !row.isFlaggedFake && (
            <>
              <button
                onClick={() => setVerifyCompany(row)}
                className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                title="Verify Company"
              >
                <Check size={14} />
              </button>
              <button
                onClick={() => { setFlagCompany(row); setFlagReason(""); setAlsoBlockReporter(false); }}
                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Flag as Fake"
              >
                <AlertTriangle size={14} />
              </button>
            </>
          )}

          {/* Verified company can still be flagged fake */}
          {row.isVerifiedByAdmin && !row.isFlaggedFake && (
            <button
              onClick={() => { setFlagCompany(row); setFlagReason(""); setAlsoBlockReporter(false); }}
              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Flag as Fake"
            >
              <AlertTriangle size={14} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Companies</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage tiffin client companies</p>
        </div>
        <Button
          variant="primary"
          leftIcon={<Plus size={16} />}
          onClick={() => { setEditCompany(null); setModalOpen(true); }}
        >
          Add Company
        </Button>
      </div>

      {/* Tabs Layout */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4" aria-label="Tabs">
          {(["verified", "pending", "flagged"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-all focus:outline-none capitalize ${
                tab === t
                  ? "border-orange-500 text-orange-600 font-semibold"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search companies..." className="max-w-xs" />
      </div>

      {/* Table */}
      <Table
        columns={columns}
        data={companies}
        isLoading={isLoading}
        emptyMessage={`No ${tab} companies found`}
        emptySubMessage={search ? "Try a different search term" : "Add a company or wait for user submissions"}
      />

      {/* Footer */}
      {!isLoading && total > 0 && (
        <p className="text-xs text-gray-400">Showing {companies.length} of {total} companies</p>
      )}

      {/* Modals */}
      <CompanyModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditCompany(null); }}
        onSuccess={fetchCompanies}
        company={editCompany}
      />
      
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        message="Are you sure you want to delete this company? This cannot be undone."
      />

      {/* Verification Confirm Modal */}
      <ConfirmDialog
        isOpen={!!verifyCompany}
        onClose={() => setVerifyCompany(null)}
        onConfirm={handleVerify}
        isLoading={isVerifying}
        title="Verify Company"
        confirmLabel="Verify"
        message={`Verify "${verifyCompany?.name}"? Once verified, it will instantly appear in the registration dropdown for new customers.`}
      />

      {/* Flag Fake Modal */}
      {flagCompany && (
        <Modal
          isOpen={true}
          onClose={() => setFlagCompany(null)}
          title={`Flag Company: ${flagCompany.name}`}
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setFlagCompany(null)} disabled={isFlagging}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleFlagFake} isLoading={isFlagging}>
                Flag as Fake
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600 leading-relaxed">
              Flagging this company as fake will hide it from the dropdown.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500">Reason</label>
              <textarea
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                placeholder="Why is this company fake? (e.g. Typo/Spam)"
                rows={3}
                className="w-full border border-gray-200 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-700 placeholder-gray-300"
                required
              />
            </div>

            {flagCompany.addedByUser && (
              <label className="flex items-center gap-2 select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={alsoBlockReporter}
                  onChange={(e) => setAlsoBlockReporter(e.target.checked)}
                  className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                />
                <span className="text-xs text-gray-600 font-medium">
                  Also block reporter ({flagCompany.addedByUser.name})
                </span>
              </label>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
