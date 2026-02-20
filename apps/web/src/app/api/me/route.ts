import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UpdateProfileSchema } from "@/lib/validations/profile";

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json(
      { error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: currentUser.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      status: true,
      createdAt: true,
      password: true,
      accounts: { select: { provider: true } },
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: { message: "User not found", code: "NOT_FOUND" } },
      { status: 404 }
    );
  }

  const { password, accounts, ...rest } = user;
  const providers = [
    ...accounts.map((a) => a.provider),
    ...(password ? ["credentials"] : []),
  ];

  return NextResponse.json({ data: { ...rest, providers } });
}

export async function PATCH(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json(
      { error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  const body = await req.json();
  const parsed = UpdateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          message: "Dati non validi",
          code: "INVALID_DATA",
          details: parsed.error.flatten(),
        },
      },
      { status: 400 }
    );
  }

  const { name, image } = parsed.data;

  const updated = await prisma.user.update({
    where: { id: currentUser.id },
    data: {
      name,
      image: image || null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      status: true,
    },
  });

  return NextResponse.json({ data: updated });
}
