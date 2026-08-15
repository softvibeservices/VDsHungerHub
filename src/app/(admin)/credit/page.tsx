// src\app\(admin)\credit\page.tsx

"use client";

import { useEffect, useState, useMemo } from "react";
import Table, { Column } from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import SearchInput from "@/components/ui/SearchInput";
import Select from "@/components/ui/Select";
import ToggleSwitch from "@/components/ui/ToggleSwitch";
import PageToolbar from "@/components/ui/PageToolbar";
import HistoryModal from "./_HistoryModal";
import PaymentModal from "./_PaymentModal";
import { useToast } from "@/hooks/useToast";
import { useDebounce } from "@/hooks/useDebounce";
import { formatCurrency, formatMobileNumber } from "@/lib/utils";
import { formatDateTimeIST } from "@/lib/time";
import { UserLedgerRow } from "@/types";
import { generateBulkOutstandingPdf, generateCompanyGroupedOutstandingPdf, generateUserBillPdf } from "@/lib/pdf-bill";
import { buildWhatsAppBillText, buildWhatsAppDigestText, buildWhatsAppCompanyDigestText, buildWhatsAppShareLink } from "@/lib/whatsapp-bill";
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
  Calendar,
  FilterX,
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

  // Date Range Filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

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
  }, [debouncedSearch, companyFilter, balanceFilter, sortBy, startDate, endDate]);

  // Handle PDF Export for a single user (with active date range if set)
  const handleExportUserPdf = async (userId: string) => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await fetch(`/api/admin/credit/${userId}?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load user detail");
      const detail = await res.json();
      generateUserBillPdf(detail);
      toast.success("Statement PDF downloaded");
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

  // Group digest action
  const handleCopyGroupDigest = () => {
    const text = groupByCompany && groupedRows
      ? buildWhatsAppCompanyDigestText(groupedRows)
      : buildWhatsAppDigestText(rows);
    navigator.clipboard.writeText(text);
    toast.success("Group outstanding digest copied to clipboard!");
  };

  // Bulk PDF Export
  const handleBulkExportPdf = () => {
    if (rows.length === 0) {
      toast.error("No data to export");
      return;
    }
    if (groupByCompany && groupedRows) {
      generateCompanyGroupedOutstandingPdf(groupedRows);
    } else {
      generateBulkOutstandingPdf(rows);
    }
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

  // Date Range Quick Preset Handlers
  const handlePreset1to15 = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    setStartDate(`${year}-${month}-01`);
    setEndDate(`${year}-${month}-15`);
  };

  const handlePreset16toEnd = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
    setStartDate(`${year}-${month}-16`);
    setEndDate(`${year}-${month}-${lastDay}`);
  };

  const handlePresetThisMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
    setStartDate(`${year}-${month}-01`);
    setEndDate(`${year}-${month}-${lastDay}`);
  };

  const handleClearDateRange = () => {
    setStartDate("");
    setEndDate("");
  };

  const columns: Column<UserLedgerRow>[] = [
    {
      key: "name",
      header: "Customer",
      render: (r: UserLedgerRow) => (
        <div>
          <p className="font-bold text-gray-900">{r.name}</p>
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
        <span className="text-sm font-semibold text-gray-800">{formatCurrency(r.totalDebit)}</span>
      ),
    },
    {
      key: "totalPaid",
      header: "Total Paid",
      render: (r: UserLedgerRow) => (
        <span className="text-sm font-semibold text-emerald-600">{formatCurrency(r.totalPaid)}</span>
      ),
    },
    {
      key: "balance",
      header: "Balance Due",
      render: (r: UserLedgerRow) => (
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold ${
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
        <div className="flex items-center gap-2 flex-wrap">
          {/* Primary: Record Payment */}
          <Button
            variant="primary"
            size="sm"
            onClick={() => setPaymentUser({ id: r.id, name: r.name, balance: r.balance })}
            className="gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 border-0"
          >
            <Plus className="w-3.5 h-3.5" /> Pay
          </Button>

          {/* Statement & PDF Actions */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSelectedUserForHistory(r.id)}
            className="gap-1.5 text-xs font-semibold"
          >
            <History className="w-3.5 h-3.5" /> Statement
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleExportUserPdf(r.id)}
            className="gap-1.5 text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" /> PDF
          </Button>

          <button
            onClick={() => handleOpenWhatsApp(r)}
            title="Send bill via WhatsApp"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageToolbar
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-extrabold bg-red-50 text-red-700 border border-red-200 px-3 py-1 rounded-full shadow-sm flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-red-600" />
              Outstanding: {formatCurrency(totals.totalOwed)}
            </span>
            <span className="text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full shadow-sm flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              Collected: {formatCurrency(totals.totalCollected)}
            </span>
            <span className="text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1 rounded-full shadow-sm flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-amber-600" />
              Owing: {totals.customersOwing} <span className="text-[10px] text-amber-600">/ {totals.userCount}</span>
            </span>
          </div>
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyGroupDigest}
              className="gap-1.5 text-emerald-700 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100"
            >
              <Copy className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp Digest
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleBulkExportPdf}
            >
              <Download className="w-3.5 h-3.5" />
              {companyFilter && companies.find((c) => c.id === companyFilter)?.name
                ? `Export ${companies.find((c) => c.id === companyFilter)?.name} PDF`
                : groupByCompany
                ? "Export Company Grouped PDF"
                : "Export PDF Report"}
            </Button>
          </>
        }
      />

      {/* Ultra-compact Filters & Date Range Toolbar */}
      <div className="bg-white p-3 md:p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
        {/* Row 1: Search, Company, Balance, Sort */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <SearchInput
            placeholder="Search name or mobile..."
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
              { value: "balance_desc", label: "Sort: Highest Balance" },
              { value: "balance_asc", label: "Sort: Lowest Balance" },
              { value: "name_asc", label: "Sort: Name (A to Z)" },
              { value: "name_desc", label: "Sort: Name (Z to A)" },
              { value: "lastOrder_desc", label: "Sort: Recent Order" },
            ]}
          />
        </div>

        {/* Row 2: Date Range, Presets, Group by Company Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-gray-400" /> Period:
            </span>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-auto text-xs py-1"
            />
            <span className="text-xs text-gray-400 font-bold">to</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-auto text-xs py-1"
            />

            <div className="flex items-center gap-1 flex-wrap ml-1">
              <button
                onClick={handlePreset1to15}
                className="px-2 py-0.5 text-xs font-bold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer"
              >
                1st–15th
              </button>
              <button
                onClick={handlePreset16toEnd}
                className="px-2 py-0.5 text-xs font-bold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer"
              >
                16th–End
              </button>
              <button
                onClick={handlePresetThisMonth}
                className="px-2 py-0.5 text-xs font-bold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer"
              >
                This Month
              </button>
              {(startDate || endDate) && (
                <button
                  onClick={handleClearDateRange}
                  className="px-2 py-0.5 text-xs font-bold rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <FilterX className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ToggleSwitch
              checked={groupByCompany}
              onChange={(checked: boolean) => setGroupByCompany(checked)}
              label="Group by Company"
            />
            <span className="text-xs text-gray-400 font-medium">
              ({rows.length} customers)
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Table */}
      {groupByCompany && groupedRows ? (
        <div className="space-y-4">
          {groupedRows.map((group) => {
            const groupTotalDebit = group.items.reduce((s, i) => s + i.totalDebit, 0);
            const groupTotalPaid = group.items.reduce((s, i) => s + i.totalPaid, 0);
            const groupBalance = group.items.reduce((s, i) => s + i.balance, 0);

            return (
              <div
                key={group.companyName}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
              >
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                    <Building2 className="w-4 h-4 text-orange-500" /> {group.companyName}
                    <span className="text-xs font-normal text-gray-400">
                      ({group.items.length} users)
                    </span>
                  </h3>

                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="text-xs font-semibold flex items-center gap-3 text-gray-600">
                      <span>Billed: {formatCurrency(groupTotalDebit)}</span>
                      <span>Paid: {formatCurrency(groupTotalPaid)}</span>
                      <span className="text-red-600 font-bold">
                        Outstanding: {formatCurrency(groupBalance)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        generateCompanyGroupedOutstandingPdf([group]);
                        toast.success(`${group.companyName} PDF downloaded`);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg shadow-sm transition-all cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-orange-500" /> Export Company PDF
                    </button>
                  </div>
                </div>

                <Table columns={columns} data={group.items} isLoading={isLoading} />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <Table columns={columns} data={rows} isLoading={isLoading} />
        </div>
      )}

      {/* Modals */}
      <HistoryModal
        isOpen={!!selectedUserForHistory}
        onClose={() => setSelectedUserForHistory(null)}
        userId={selectedUserForHistory}
        initialStartDate={startDate}
        initialEndDate={endDate}
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
