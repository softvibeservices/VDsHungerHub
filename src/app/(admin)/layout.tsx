"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import toast from "react-hot-toast";
import Sidebar from "@/components/admin/Sidebar";
import Header from "../../components/admin/Header"; // Admin top navigation header
import { useKeyboard } from "@/hooks/useKeyboard";
import { useCurrentUserWithRefresh } from "@/hooks/useCurrentUser";
import { isAdminOnlyPage, requiredPermissionForPage } from "@/lib/rbac";
import { hasPermission } from "@/lib/rbac-client";

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
  const [currentUser, refreshCurrentUser] = useCurrentUserWithRefresh();
  const hasLoadedOnce = useRef(false);
  const prevPermissionsKey = useRef<string | null>(null);
  useKeyboard();

  // Initial auth gate: wait for the first /api/staff/me response before
  // rendering anything, exactly as before.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsAuthChecking(true);
      await refreshCurrentUser();
      if (!cancelled) {
        hasLoadedOnce.current = true;
        setIsAuthChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-run the authorization decision whenever EITHER the route changes OR
  // the live user data changes (permission/role edited by an admin,
  // account deactivated/deleted, etc. — picked up by the polling/focus
  // refetch inside useCurrentUserWithRefresh without the user navigating).
  useEffect(() => {
    if (!hasLoadedOnce.current) return;

    if (!currentUser) {
      setIsAuthorized(false);
      router.replace("/staff-login");
      return;
    }

    if (isAdminOnlyPage(pathname) && currentUser.role !== "ADMIN") {
      setIsAuthorized(false);
      toast.error("You no longer have access to that section.");
      router.replace("/dashboard");
      return;
    }

    const requiredPermission = requiredPermissionForPage(pathname);
    if (requiredPermission && !hasPermission(currentUser, requiredPermission)) {
      setIsAuthorized(false);
      toast.error("You no longer have access to that section.");
      router.replace("/dashboard");
      return;
    }

    setIsAuthorized(true);

    // Detect an in-place permission change (admin edited this staff
    // member's permissions while they stayed on an ALLOWED page) and let
    // them know, without forcing a redirect since the current page is
    // still valid for them.
    const key = JSON.stringify([currentUser.role, [...(currentUser.permissions ?? [])].sort()]);
    if (prevPermissionsKey.current !== null && prevPermissionsKey.current !== key) {
      toast.success("Your permissions were updated by an admin.");
    }
    prevPermissionsKey.current = key;
  }, [currentUser, pathname, router]);

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
