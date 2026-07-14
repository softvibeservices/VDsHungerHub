"use client";

import Link from "next/link";
import { UserCheck, ArrowRight } from "lucide-react";

export default function StaffTab() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-sm max-w-lg mx-auto my-8 space-y-5">
      <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto text-orange-500">
        <UserCheck size={32} />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-bold text-gray-900">Unified Staff Management</h3>
        <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
          Staff authentication has been upgraded to a secure OTP system. Staff members, access control, and permissions are now managed in the dedicated Staff Panel.
        </p>
      </div>
      <div className="pt-2">
        <Link
          href="/staff"
          className="inline-flex items-center gap-2 px-5 py-3 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-bold rounded-xl text-xs shadow-sm hover:shadow shadow-orange-500/10 transition-all cursor-pointer"
        >
          <span>Go to Staff Management</span>
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
