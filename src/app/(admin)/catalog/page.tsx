"use client";

import { useState } from "react";
import ProductsTab from "./_ProductsTab";
import ThalisTab from "./_ThalisTab";
import StaffTab from "./_StaffTab";

type Tab = "products" | "thalis" | "staff";

const tabs: { key: Tab; label: string; emoji: string }[] = [
  { key: "products", label: "Products", emoji: "🥘" },
  { key: "thalis", label: "Thalis", emoji: "🍱" },
  { key: "staff", label: "Staff", emoji: "👤" },
];

export default function CatalogPage() {
  const [activeTab, setActiveTab] = useState<Tab>("products");

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Catalog</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage products, thalis, and staff in one place
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer
              ${activeTab === tab.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
              }
            `}
          >
            <span>{tab.emoji}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {activeTab === "products" && <ProductsTab />}
        {activeTab === "thalis" && <ThalisTab />}
        {activeTab === "staff" && <StaffTab />}
      </div>
    </div>
  );
}
