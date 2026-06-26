"use client";

import { useState } from "react";
import Sidebar from "@/components/admin/Sidebar";
import Header from "../../components/admin/Header"; // Admin top navigation header
import { useKeyboard } from "@/hooks/useKeyboard";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useKeyboard();

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-[260px]">
        <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-12">{children}</main>
        
        {/* Keyboard Shortcuts Hint Bar */}
        <div className="hidden md:flex items-center justify-center gap-4 py-1.5 bg-gray-50 border-t border-gray-200 text-[10px] text-gray-400 font-medium">
          <span>Shortcuts:</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded-md font-mono font-bold text-gray-600 shadow-sm mr-1">D</kbd>Dashboard</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded-md font-mono font-bold text-gray-600 shadow-sm mr-1">O</kbd>Orders</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded-md font-mono font-bold text-gray-600 shadow-sm mr-1">M</kbd>Daily Menu</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded-md font-mono font-bold text-gray-600 shadow-sm mr-1">K</kbd>Catalog</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded-md font-mono font-bold text-gray-600 shadow-sm mr-1">C</kbd>Companies</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded-md font-mono font-bold text-gray-600 shadow-sm mr-1">U</kbd>Users</span>
        </div>
      </div>
    </div>
  );
}
