import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json(
      { error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  const { count } = await prisma.notification.updateMany({
    where: { userId: currentUser.id, read: false },
    data: { read: true },
  });

  return NextResponse.json({ data: { count } });
}
