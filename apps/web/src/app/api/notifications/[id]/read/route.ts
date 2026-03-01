import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(_req: Request, { params }: RouteParams) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json(
      { error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  const { id } = await params;

  try {
    await prisma.notification.update({
      where: { id, userId: currentUser.id },
      data: { read: true },
    });
  } catch {
    // P2025: record not found — ignore silently
  }

  return NextResponse.json({ data: { ok: true } });
}
