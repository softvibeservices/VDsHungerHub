import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAuth } from "@/lib/staff-auth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffAuth(req, { permission: "menu:manage" });
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    await prisma.menuTemplate.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[template/delete]", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
