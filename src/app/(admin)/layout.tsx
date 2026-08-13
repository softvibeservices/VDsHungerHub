"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/admin/Sidebar";
import Header from "../../components/admin/Header"; // Admin top navigation header
import { useKeyboard } from "@/hooks/useKeyboard";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  useKeyboard();

  useEffect(() => {
    async function verifyAuth() {
      try {
        const res = await fetch("/api/staff/me");
        if (!res.ok) {
          router.push("/staff-login");
          return;
        }
        const data = await res.json();
        if (!data.user) {
          router.push("/staff-login");
          return;
        }
        setIsAuthorized(true);
      } catch {
        router.push("/staff-login");
      } finally {
        setIsAuthChecking(false);
      }
    }
    verifyAuth();
  }, [router]);

  if (isAuthChecking) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-900 text-white space-y-4">
        <div className="w-10 h-10 border-4 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-gray-300">Verifying Admin Permissions…</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

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
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${sidebarOpen ? "lg:ml-[260px]" : "lg:ml-0"}`}>
        <Header onMenuToggle={() => setSidebarOpen((v) => !v)} />
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
