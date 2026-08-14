"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "@/components/admin/Sidebar";
import Header from "../../components/admin/Header"; // Admin top navigation header
import { useKeyboard } from "@/hooks/useKeyboard";
import { isAdminOnlyPage } from "@/lib/rbac";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  useKeyboard();

  useEffect(() => {
    let cancelled = false;

    async function verifyAuth() {
      setIsAuthChecking(true);
      setIsAuthorized(false);
      try {
        const res = await fetch("/api/staff/me");
        if (!res.ok) {
          router.replace("/staff-login");
          return;
        }
        const data = await res.json();
        if (!data.user) {
          router.replace("/staff-login");
          return;
        }

        // Role gate — mirrors src/proxy.ts and src/lib/rbac.ts. Re-checked on
        // every pathname change (not just on first mount) because this
        // layout persists across client-side navigation within (admin)/.
        if (isAdminOnlyPage(pathname) && data.user.role !== "ADMIN") {
          router.replace("/dashboard");
          return;
        }

        if (!cancelled) setIsAuthorized(true);
      } catch {
        router.replace("/staff-login");
      } finally {
        if (!cancelled) setIsAuthChecking(false);
      }
    }

    verifyAuth();
    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

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
          <span><kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded-md font-mono font-bold text-gray-600 shadow-sm mr-1">Alt+D</kbd>Dashboard</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded-md font-mono font-bold text-gray-600 shadow-sm mr-1">Alt+O</kbd>Orders</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded-md font-mono font-bold text-gray-600 shadow-sm mr-1">Alt+M</kbd>Daily Menu</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded-md font-mono font-bold text-gray-600 shadow-sm mr-1">Alt+K</kbd>Catalog</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded-md font-mono font-bold text-gray-600 shadow-sm mr-1">Alt+C</kbd>Companies</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded-md font-mono font-bold text-gray-600 shadow-sm mr-1">Alt+U</kbd>Users</span>
        </div>
      </div>
    </div>
  );
}
