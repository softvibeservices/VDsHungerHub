"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "@/components/admin/Sidebar";
import Header from "../../components/admin/Header"; // Admin top navigation header
import { useKeyboard } from "@/hooks/useKeyboard";
import { isAdminOnlyPage } from "@/lib/rbac";

interface StaffUser {
  id: string;
  name: string;
  mobile: string;
  role: "ADMIN" | "STAFF";
  permissions: string[];
}

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
  const currentUserRef = useRef<StaffUser | null>(null);
  useKeyboard();

  useEffect(() => {
    let cancelled = false;

    async function verifyAuth() {
      const hasExistingUser = currentUserRef.current !== null;

      // Only show full-screen auth checking on initial layout load
      if (!hasExistingUser) {
        setIsAuthChecking(true);
        setIsAuthorized(false);
      }

      // Synchronous role gate check if user payload is already cached
      if (hasExistingUser && currentUserRef.current) {
        if (isAdminOnlyPage(pathname) && currentUserRef.current.role !== "ADMIN") {
          router.replace("/dashboard");
          return;
        }
      }

      try {
        const res = await fetch("/api/staff/me");
        if (cancelled) return;

        if (!res.ok) {
          router.replace("/staff-login");
          return;
        }
        const data = await res.json();
        if (!data.user) {
          router.replace("/staff-login");
          return;
        }

        currentUserRef.current = data.user;

        // Role gate check with fresh user data
        if (isAdminOnlyPage(pathname) && data.user.role !== "ADMIN") {
          router.replace("/dashboard");
          return;
        }

        if (!cancelled) {
          setIsAuthorized(true);
          setIsAuthChecking(false);
        }
      } catch {
        if (!cancelled) {
          router.replace("/staff-login");
        }
      } finally {
        if (!cancelled && !hasExistingUser) {
          setIsAuthChecking(false);
        }
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
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
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
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-12">
          <div className="max-w-[1440px] mx-auto w-full">{children}</div>
        </main>

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
