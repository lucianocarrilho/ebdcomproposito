import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET - Listar líderes
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role");

    const where: Record<string, unknown> = { active: true };
    if (role && role !== "Todos") where.role = role;

    const leaders = await prisma.leader.findMany({
      where,
      include: { class: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(leaders);
  } catch (error) {
    console.error("Erro ao buscar líderes:", error);
    return NextResponse.json({ error: "Erro ao buscar líderes" }, { status: 500 });
  }
}

// POST - Criar líder
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, role, phone, email, classId, startDate, observations, photo } = body;

    if (!name || !role) {
      return NextResponse.json({ error: "Nome e cargo são obrigatórios" }, { status: 400 });
    }

    const leader = await prisma.leader.create({
      data: {
        name,
        role,
        phone,
        email,
        class: classId && classId !== "none" ? { connect: { id: classId } } : undefined,
        startDate: startDate ? new Date(startDate) : new Date(),
        observations,
        photo,
      },
      include: { class: { select: { id: true, name: true } } },
    });

    return NextResponse.json(leader, { status: 201 });
  } catch (error: any) {
    console.error("Erro ao criar líder:", error);
    return NextResponse.json({ error: error.message || "Erro ao criar líder" }, { status: 500 });
  }
}
