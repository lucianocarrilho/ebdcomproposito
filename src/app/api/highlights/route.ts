import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET - Listar destaques
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const quarter = searchParams.get("quarter");

    const where: Record<string, unknown> = {};
    if (quarter) where.quarter = quarter;

    const highlights = await prisma.quarterHighlight.findMany({
      where,
      include: {
        student: { select: { name: true } },
        class: { select: { name: true } },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json(highlights);
  } catch (error) {
    console.error("Erro ao buscar destaques:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// POST - Criar destaque
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, classId, quarter, reason, type, photo } = body;

    if (!studentId || !classId || !reason) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }

    const highlight = await prisma.quarterHighlight.create({
      data: {
        studentId,
        classId,
        quarter: quarter || "2026-Q1",
        reason,
        type: type || "destaque",
        photo,
      },
      include: {
        student: { select: { name: true } },
        class: { select: { name: true } },
      },
    });

    return NextResponse.json(highlight, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar destaque:", error);
    return NextResponse.json({ error: "Erro ao criar" }, { status: 500 });
  }
}
