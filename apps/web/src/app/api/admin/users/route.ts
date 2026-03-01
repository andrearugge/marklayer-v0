import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UsersQuerySchema, CreateUserSchema } from "@/lib/validations/admin";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit";

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
  const parsed = UsersQuerySchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    role: searchParams.get("role") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    search: searchParams.get("search") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: "Invalid parameters", code: "INVALID_PARAMS" } },
      { status: 400 }
    );
  }

  const { page, limit, role, status, search } = parsed.data;

  const where = {
    ...(role ? { role } : {}),
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({
    data: {
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function POST(req: Request) {
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

  const body = await req.json();
  const parsed = CreateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: parsed.error.issues[0].message } },
      { status: 400 }
    );
  }

  const { name, email, password, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: { message: "Email già in uso", code: "EMAIL_EXISTS" } },
      { status: 409 }
    );
  }

  const hashed = await bcrypt.hash(password, 12);
  const created = await prisma.user.create({
    data: { name, email, password: hashed, role, status: "active" },
    select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
  });

  await logAuditEvent({
    action: AUDIT_ACTIONS.USER_CREATED,
    actorId: currentUser.id,
    actorEmail: currentUser.email ?? undefined,
    targetId: created.id,
    targetEmail: created.email,
    metadata: { role },
  });

  return NextResponse.json({ data: created }, { status: 201 });
}
