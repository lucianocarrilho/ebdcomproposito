import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET - Listar justificativas
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");

    const where: Record<string, unknown> = {};
    if (studentId) where.studentId = studentId;

    const justifications = await prisma.absenceJustification.findMany({
      where,
      include: {
        student: { select: { name: true, class: { select: { name: true } } } },
        registeredBy: { select: { name: true } },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json(justifications);
  } catch (error) {
    console.error("Erro ao buscar justificativas:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// POST - Criar justificativa
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, date, reason, observations, registeredById } = body;

    if (!studentId || !date || !reason) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }

    const justification = await prisma.absenceJustification.create({
      data: {
        studentId,
        date: new Date(date),
        reason,
        observations,
        registeredById: registeredById || null,
      },
      include: {
        student: { select: { name: true } },
      },
    });

    return NextResponse.json(justification, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar justificativa:", error);
    return NextResponse.json({ error: "Erro ao criar" }, { status: 500 });
  }
}
