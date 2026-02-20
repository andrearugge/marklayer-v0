import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const RegisterBodySchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RegisterBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { message: "Dati non validi", code: "VALIDATION_ERROR" } },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        {
          error: {
            message: "Esiste già un account con questa email",
            code: "EMAIL_EXISTS",
          },
        },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword },
      select: { id: true, email: true, name: true },
    });

    return NextResponse.json({ data: user }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: { message: "Errore interno del server", code: "SERVER_ERROR" } },
      { status: 500 }
    );
  }
}
