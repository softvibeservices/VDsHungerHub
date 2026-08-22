// src/components/customer/CompanySearchCombobox.tsx

"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Search, Building2, MapPin, Check, Plus, X, ChevronDown } from "lucide-react";

export interface CompanyOption {
  id: string;
  name: string;
  address?: string | null;
  location?: string | null;
}

interface CompanySearchComboboxProps {
  companies: CompanyOption[];
  selectedCompanyId: string;
  onSelectCompany: (companyId: string) => void;
  onAddNewCompany: () => void;
  disabled?: boolean;
}

export default function CompanySearchCombobox({
  companies,
  selectedCompanyId,
  onSelectCompany,
  onAddNewCompany,
  disabled = false,
}: CompanySearchComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === selectedCompanyId),
    [companies, selectedCompanyId]
  );

  // Live filter on every single character typed
  const filteredCompanies = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return companies;

    return companies.filter((c) => {
      const nameMatch = c.name.toLowerCase().includes(query);
      const locMatch = c.location?.toLowerCase().includes(query) ?? false;
      const addrMatch = c.address?.toLowerCase().includes(query) ?? false;
      return nameMatch || locMatch || addrMatch;
    });
  }, [companies, searchQuery]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (!isOpen && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter")) {
      setIsOpen(true);
      return;
    }

    if (e.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    const totalItems = filteredCompanies.length + 1;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % totalItems);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + totalItems) % totalItems);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < filteredCompanies.length) {
        const item = filteredCompanies[activeIndex];
        onSelectCompany(item.id);
        setIsOpen(false);
        setSearchQuery("");
      } else if (activeIndex === filteredCompanies.length) {
        onAddNewCompany();
        setIsOpen(false);
        setSearchQuery("");
      }
    }
  };

  const handleSelect = (companyId: string) => {
    onSelectCompany(companyId);
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectCompany("");
    setSearchQuery("");
    if (inputRef.current) inputRef.current.focus();
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Combobox Trigger / Search Input Bar */}
      <div
        onClick={() => {
          if (!disabled) {
            setIsOpen(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }
        }}
        className={`relative flex items-center w-full min-h-[44px] px-3.5 py-2 bg-white border rounded-xl shadow-xs transition-all cursor-pointer select-none ${
          isOpen
            ? "border-orange-500 ring-2 ring-orange-500/20"
            : "border-gray-200 hover:border-gray-300"
        } ${disabled ? "opacity-60 cursor-not-allowed bg-gray-50" : ""}`}
      >
        <Search className="w-4 h-4 text-gray-400 shrink-0 mr-2.5" />

        {/* Dynamic Display / Live Search Text Input */}
        <div className="flex-1 flex items-center overflow-hidden">
          {isOpen ? (
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder={selectedCompany ? selectedCompany.name : "Type to search company..."}
              className="w-full text-sm text-gray-900 placeholder-gray-400 bg-transparent outline-none border-none p-0 focus:ring-0"
              autoFocus
            />
          ) : selectedCompany ? (
            <span className="text-sm font-bold text-gray-900 truncate" title={selectedCompany.name}>
              {selectedCompany.name}
            </span>
          ) : (
            <span className="text-sm text-gray-400">Search or select your company...</span>
          )}
        </div>

        {/* Clear Button & Chevron Indicator */}
        <div className="flex items-center gap-1 ml-2 shrink-0">
          {selectedCompany && !isOpen && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown
            className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-orange-500" : ""
            }`}
          />
        </div>
      </div>

      {/* Floating Suggestions Dropdown */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden max-h-64 flex flex-col animate-in fade-in-50 slide-in-from-top-2 duration-150">
          {/* Header query indicator when filtering */}
          {searchQuery.trim().length > 0 && (
            <div className="px-3.5 py-1.5 bg-gray-50 border-b border-gray-100 text-[11px] font-medium text-gray-500 flex items-center justify-between">
              <span>Suggestions matching &ldquo;<strong className="text-orange-600 font-semibold">{searchQuery.trim()}</strong>&rdquo;</span>
              <span className="text-[10px] text-gray-400">{filteredCompanies.length} found</span>
            </div>
          )}

          {/* Scrollable Suggestions List */}
          <div className="overflow-y-auto py-1 divide-y divide-gray-50">
            {filteredCompanies.length > 0 ? (
              filteredCompanies.map((company, index) => {
                const isSelected = company.id === selectedCompanyId;
                const isActive = index === activeIndex;

                return (
                  <div
                    key={company.id}
                    onClick={() => handleSelect(company.id)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`px-3.5 py-2.5 flex items-start justify-between cursor-pointer transition-colors ${
                      isActive ? "bg-orange-50/80 text-orange-900" : "hover:bg-gray-50 text-gray-800"
                    } ${isSelected ? "bg-orange-50/50 font-medium" : ""}`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0 pr-2">
                      <Building2 className={`w-4 h-4 mt-0.5 shrink-0 ${isSelected ? "text-orange-500" : "text-gray-400"}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-gray-900 leading-tight">
                            {company.name}
                          </span>
                          {company.location && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 text-[10px] font-medium bg-gray-100 text-gray-600 rounded">
                              <MapPin className="w-2.5 h-2.5" />
                              {company.location}
                            </span>
                          )}
                        </div>
                        {company.address && (
                          <p className="text-[11px] text-gray-500 truncate mt-0.5">
                            {company.address}
                          </p>
                        )}
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />}
                  </div>
                );
              })
            ) : (
              <div className="px-3.5 py-4 text-center text-xs text-gray-500">
                No existing workplace matches &ldquo;<span className="font-medium text-gray-700">{searchQuery}</span>&rdquo;
              </div>
            )}
          </div>

          {/* "+ My company is not listed" Action Card */}
          <div
            onClick={() => {
              onAddNewCompany();
              setIsOpen(false);
              setSearchQuery("");
            }}
            onMouseEnter={() => setActiveIndex(filteredCompanies.length)}
            className={`p-3 bg-gradient-to-r from-orange-50/90 to-amber-50/90 border-t border-orange-100/80 flex items-center justify-between cursor-pointer transition-colors ${
              activeIndex === filteredCompanies.length ? "ring-1 ring-orange-400 bg-orange-100/80" : "hover:bg-orange-100/50"
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-bold text-orange-700">
              <div className="w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
              </div>
              <span>My company is not listed</span>
            </div>
            <span className="text-[10px] font-semibold text-orange-600 bg-white/80 px-2 py-0.5 rounded-full border border-orange-200/60 shadow-xs">
              + Register New
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
