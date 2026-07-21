"use client";

import { useEffect, useState, useMemo } from "react";
import Table, { Column } from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import SearchInput from "@/components/ui/SearchInput";
import Select from "@/components/ui/Select";
import ToggleSwitch from "@/components/ui/ToggleSwitch";
import HistoryModal from "./_HistoryModal";
import PaymentModal from "./_PaymentModal";
import { useToast } from "@/hooks/useToast";
import { useDebounce } from "@/hooks/useDebounce";
import { formatCurrency, formatMobileNumber } from "@/lib/utils";
import { formatDateTimeIST } from "@/lib/time";
import { UserLedgerRow } from "@/types";
import { generateBulkOutstandingPdf, generateUserBillPdf } from "@/lib/pdf-bill";
import { buildWhatsAppBillText, buildWhatsAppDigestText, buildWhatsAppShareLink } from "@/lib/whatsapp-bill";
import {
  Wallet,
  Download,
  MessageSquare,
  Copy,
  Plus,
  History,
  Building2,
  Users,
  CheckCircle,
} from "lucide-react";

interface CompanyOption {
  id: string;
  name: string;
}

interface LedgerTotals {
  totalOwed: number;
  totalCollected: number;
  customersOwing: number;
  userCount: number;
}

export default function CreditPage() {
  const toast = useToast();
  const [rows, setRows] = useState<UserLedgerRow[]>([]);
  const [totals, setTotals] = useState<LedgerTotals>({
    totalOwed: 0,
    totalCollected: 0,
    customersOwing: 0,
    userCount: 0,
  });
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [balanceFilter, setBalanceFilter] = useState<"all" | "owing" | "clear">("owing");
  const [sortBy, setSortBy] = useState<string>("balance_desc");
  const [groupByCompany, setGroupByCompany] = useState(false);

  const debouncedSearch = useDebounce(search, 300);

  // Modal States
  const [selectedUserForHistory, setSelectedUserForHistory] = useState<string | null>(null);
  const [paymentUser, setPaymentUser] = useState<{ id: string; name: string; balance: number } | null>(
    null
  );

  const fetchCompanies = async () => {
    try {
      const res = await fetch("/api/companies?limit=500");
      if (res.ok) {
        const json = await res.json();
        setCompanies(json.companies ?? []);
      }
    } catch (err) {
      console.error("Failed to load companies:", err);
    }
  };

  const fetchLedger = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (companyFilter) params.set("companyId", companyFilter);
      if (balanceFilter) params.set("balanceFilter", balanceFilter);
      if (sortBy) params.set("sortBy", sortBy);

      const res = await fetch(`/api/admin/credit?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to fetch credit ledger");
      }
      const json = await res.json();
      setRows(json.rows ?? []);
      setTotals(
        json.totals ?? { totalOwed: 0, totalCollected: 0, customersOwing: 0, userCount: 0 }
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error loading ledger");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    fetchLedger();
  }, [debouncedSearch, companyFilter, balanceFilter, sortBy]);

  // Handle PDF Export for a single user
  const handleExportUserPdf = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/credit/${userId}`);
      if (!res.ok) throw new Error("Failed to load user detail");
      const detail = await res.json();
      generateUserBillPdf(detail);
      toast.success("Bill PDF downloaded");
    } catch {
      toast.error("Failed to generate PDF");
    }
  };

  // WhatsApp 1:1 action
  const handleOpenWhatsApp = (row: UserLedgerRow) => {
    const msg = buildWhatsAppBillText(row);
    const link = buildWhatsAppShareLink(row.number, msg);
    window.open(link, "_blank");
  };

  const handleCopyWhatsAppText = (row: UserLedgerRow) => {
    const msg = buildWhatsAppBillText(row);
    navigator.clipboard.writeText(msg);
    toast.success("WhatsApp bill copied to clipboard");
  };

  // Group digest action
  const handleCopyGroupDigest = () => {
    const text = buildWhatsAppDigestText(rows);
    navigator.clipboard.writeText(text);
    toast.success("Group outstanding digest copied to clipboard!");
  };

  // Bulk PDF Export
  const handleBulkExportPdf = () => {
    if (rows.length === 0) {
      toast.error("No data to export");
      return;
    }
    generateBulkOutstandingPdf(rows);
    toast.success("Outstanding report PDF generated");
  };

  // Grouping logic when "Group by Company" is toggled
  const groupedRows = useMemo(() => {
    if (!groupByCompany) return null;
    const map = new Map<string, { companyName: string; items: UserLedgerRow[] }>();

    rows.forEach((r) => {
      const compId = r.company?.id ?? "unassigned";
      const compName = r.company?.name ?? "Independent / No Company";
      if (!map.has(compId)) {
        map.set(compId, { companyName: compName, items: [] });
      }
      map.get(compId)!.items.push(r);
    });

    return Array.from(map.values());
  }, [rows, groupByCompany]);

  const columns: Column<UserLedgerRow>[] = [
    {
      key: "name",
      header: "Customer",
      render: (r: UserLedgerRow) => (
        <div>
          <p className="font-semibold text-gray-900">{r.name}</p>
          <p className="text-xs text-gray-400">{formatMobileNumber(r.number)}</p>
        </div>
      ),
    },
    {
      key: "company",
      header: "Company",
      render: (r: UserLedgerRow) => (
        <span className="text-sm text-gray-600 font-medium">
          {r.company?.name ?? <span className="text-gray-400 italic">—</span>}
        </span>
      ),
    },
    {
      key: "totalDebit",
      header: "Total Billed",
      render: (r: UserLedgerRow) => (
        <span className="text-sm font-medium text-gray-700">{formatCurrency(r.totalDebit)}</span>
      ),
    },
    {
      key: "totalPaid",
      header: "Total Paid",
      render: (r: UserLedgerRow) => (
        <span className="text-sm font-medium text-emerald-600">{formatCurrency(r.totalPaid)}</span>
      ),
    },
    {
      key: "balance",
      header: "Balance Due",
      render: (r: UserLedgerRow) => (
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
            r.balance > 0
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
          }`}
        >
          {formatCurrency(r.balance)}
        </span>
      ),
    },
    {
      key: "lastOrderAt",
      header: "Last Order",
      render: (r: UserLedgerRow) => (
        <span className="text-xs text-gray-500">
          {r.lastOrderAt ? formatDateTimeIST(r.lastOrderAt) : "Never"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (r: UserLedgerRow) => (
        <div className="flex items-center gap-1.5 justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSelectedUserForHistory(r.id)}
            title="View Statement / History"
            className="p-1.5 h-8 w-8"
          >
            <History className="w-4 h-4" />
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() =>
              setPaymentUser({ id: r.id, name: r.name, balance: r.balance })
            }
            title="Record Payment"
            className="h-8 px-2 text-xs gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Pay
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleExportUserPdf(r.id)}
            title="Download PDF Bill"
            className="p-1.5 h-8 w-8 text-gray-600"
          >
            <Download className="w-4 h-4" />
          </Button>

          {/* WhatsApp Action buttons */}
          <div className="flex items-center gap-1 border-l border-gray-200 pl-1.5">
            <button
              onClick={() => handleOpenWhatsApp(r)}
              title="Open WhatsApp Chat with Bill text"
              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleCopyWhatsAppText(r)}
              title="Copy WhatsApp Bill text"
              className="p-1 text-gray-400 hover:text-gray-700 rounded transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wallet className="w-7 h-7 text-orange-500" /> Admin Credit / Debit Ledger
          </h1>
          <p className="text-sm text-gray-500">
            Track user balances, record offline payments, and generate WhatsApp / PDF reports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopyGroupDigest}
            className="gap-2 text-emerald-700 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100"
          >
            <Copy className="w-4 h-4 text-emerald-600" /> Copy WhatsApp Group Digest
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleBulkExportPdf}
            className="gap-2"
          >
            <Download className="w-4 h-4" /> Export Report (PDF)
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Total Outstanding
            </p>
            <p className="text-2xl font-bold text-red-600 mt-1">
              {formatCurrency(totals.totalOwed)}
            </p>
            <p className="text-xs text-gray-400 mt-1">Across {totals.customersOwing} owing customers</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
            <Wallet className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Total Collected
            </p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">
              {formatCurrency(totals.totalCollected)}
            </p>
            <p className="text-xs text-gray-400 mt-1">All-time payment total</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Customers Owing
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {totals.customersOwing} <span className="text-xs font-normal text-gray-400">/ {totals.userCount}</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">Accounts with balance &gt; ₹0</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
            <Users className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <SearchInput
            placeholder="Search by name or mobile..."
            value={search}
            onChange={(val) => setSearch(val)}
          />

          <Select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            options={[
              { value: "", label: "All Companies" },
              ...companies.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />

          <Select
            value={balanceFilter}
            onChange={(e) => setBalanceFilter(e.target.value as "all" | "owing" | "clear")}
            options={[
              { value: "owing", label: "Owing Only (Balance > 0)" },
              { value: "clear", label: "Cleared Only (Balance ≤ 0)" },
              { value: "all", label: "All Balances" },
            ]}
          />

          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            options={[
              { value: "balance_desc", label: "Highest Balance" },
              { value: "balance_asc", label: "Lowest Balance" },
              { value: "name_asc", label: "Name (A to Z)" },
              { value: "name_desc", label: "Name (Z to A)" },
              { value: "lastOrder_desc", label: "Most Recent Order" },
            ]}
          />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <ToggleSwitch
              checked={groupByCompany}
              onChange={(checked: boolean) => setGroupByCompany(checked)}
              label="Group by Company"
            />
          </div>

          <p className="text-xs text-gray-400">
            Showing {rows.length} customers
          </p>
        </div>
      </div>

      {/* Main Content Table or Grouped Tables */}
      {groupByCompany && groupedRows ? (
        <div className="space-y-6">
          {groupedRows.map((group) => {
            const groupTotalDebit = group.items.reduce((s, i) => s + i.totalDebit, 0);
            const groupTotalPaid = group.items.reduce((s, i) => s + i.totalPaid, 0);
            const groupBalance = group.items.reduce((s, i) => s + i.balance, 0);

            return (
              <div
                key={group.companyName}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
              >
                <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-orange-500" /> {group.companyName}
                    <span className="text-xs font-normal text-gray-400">
                      ({group.items.length} users)
                    </span>
                  </h3>

                  <div className="text-xs font-semibold flex items-center gap-4 text-gray-600">
                    <span>Billed: {formatCurrency(groupTotalDebit)}</span>
                    <span>Paid: {formatCurrency(groupTotalPaid)}</span>
                    <span className="text-red-600 font-bold">
                      Outstanding: {formatCurrency(groupBalance)}
                    </span>
                  </div>
                </div>

                <Table columns={columns} data={group.items} isLoading={isLoading} />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <Table columns={columns} data={rows} isLoading={isLoading} />
        </div>
      )}

      {/* Modals */}
      <HistoryModal
        isOpen={!!selectedUserForHistory}
        onClose={() => setSelectedUserForHistory(null)}
        userId={selectedUserForHistory}
        onOpenRecordPayment={() => {
          const user = rows.find((r) => r.id === selectedUserForHistory);
          if (user) {
            setPaymentUser({ id: user.id, name: user.name, balance: user.balance });
          }
        }}
        onRefreshParent={fetchLedger}
      />

      {paymentUser && (
        <PaymentModal
          isOpen={!!paymentUser}
          onClose={() => setPaymentUser(null)}
          user={paymentUser}
          onPaymentSuccess={() => {
            toast.success("Payment recorded successfully");
            fetchLedger();
          }}
        />
      )}
    </div>
  );
}
