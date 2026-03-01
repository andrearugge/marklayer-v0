import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertProjectOwnership } from "@/lib/projects";
import { DiscoveryScheduleSchema } from "@/lib/validations/content";

type RouteParams = { params: Promise<{ id: string }> };

function calcNextRunAt(frequency: string, from: Date): Date {
  const d = new Date(from);
  switch (frequency) {
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "quarterly":
      d.setMonth(d.getMonth() + 3);
      break;
    default:
      d.setDate(d.getDate() + 7);
  }
  return d;
}

// ─── GET — fetch current schedule ─────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json(
      { error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }
  await assertProjectOwnership(id, currentUser.id);

  const schedule = await prisma.discoverySchedule.findUnique({
    where: { projectId: id },
  });

  return NextResponse.json({ data: schedule });
}

// ─── PUT — create or update schedule ──────────────────────────────────────────

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json(
      { error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }
  await assertProjectOwnership(id, currentUser.id);

  const body = await req.json();
  const parsed = DiscoveryScheduleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: parsed.error.issues[0].message } },
      { status: 400 }
    );
  }

  const { jobType, frequency, config, enabled } = parsed.data;
  const now = new Date();
  const nextRunAt = calcNextRunAt(frequency, now);
  const configJson = config as Prisma.InputJsonValue;

  const schedule = await prisma.discoverySchedule.upsert({
    where: { projectId: id },
    create: {
      projectId: id,
      userId: currentUser.id,
      jobType,
      frequency,
      config: configJson,
      enabled,
      nextRunAt,
    },
    update: {
      jobType,
      frequency,
      config: configJson,
      enabled,
      nextRunAt,
    },
  });

  return NextResponse.json({ data: schedule });
}

// ─── PATCH — toggle enabled only ──────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json(
      { error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }
  await assertProjectOwnership(id, currentUser.id);

  const body = await req.json();
  const { enabled } = body as { enabled: boolean };

  const schedule = await prisma.discoverySchedule.update({
    where: { projectId: id },
    data: { enabled },
  });

  return NextResponse.json({ data: schedule });
}

// ─── DELETE — remove schedule ──────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json(
      { error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }
  await assertProjectOwnership(id, currentUser.id);

  try {
    await prisma.discoverySchedule.delete({ where: { projectId: id } });
  } catch {
    // P2025 — record not found, ignore
  }

  return NextResponse.json({ data: { deleted: true } });
}
