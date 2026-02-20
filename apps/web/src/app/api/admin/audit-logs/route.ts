import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuditLogsQuerySchema } from "@/lib/validations/admin";

export async function GET(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json(
      { error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }
  if (currentUser.role !== "admin") {
    return NextResponse.json(
      { error: { message: "Forbidden", code: "FORBIDDEN" } },
      { status: 403 }
    );
  }

  const { searchParams } = req.nextUrl;
  const parsed = AuditLogsQuerySchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    action: searchParams.get("action") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: "Invalid parameters", code: "INVALID_PARAMS" } },
      { status: 400 }
    );
  }

  const { page, limit, action } = parsed.data;
  const where = action ? { action } : {};

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return NextResponse.json({
    data: { logs, total, page, totalPages: Math.ceil(total / limit) },
  });
}
