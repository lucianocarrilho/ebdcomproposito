import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET - Listar alunos
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    const search = searchParams.get("search");
    const active = searchParams.get("active");

    const where: Record<string, unknown> = {};
    if (classId) where.classId = classId;
    if (active !== null && active !== undefined) where.active = active === "true";
    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    const students = await prisma.student.findMany({
      where,
      include: {
        class: { select: { id: true, name: true } },
        _count: {
          select: {
            attendanceItems: true,
            visitorsInvited: true,
            quarterHighlights: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(students);
  } catch (error) {
    console.error("Erro ao buscar alunos:", error);
    return NextResponse.json({ error: "Erro ao buscar alunos" }, { status: 500 });
  }
}

// POST - Criar aluno
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name, gender, birthDate, phone, address, guardian,
      classId, observations, baptized, member, newConvert, photo
    } = body;

    if (!name || !classId) {
      return NextResponse.json(
        { error: "Nome e classe são obrigatórios" },
        { status: 400 }
      );
    }

    const student = await prisma.student.create({
      data: {
        name,
        gender,
        birthDate: birthDate ? new Date(birthDate) : null,
        phone,
        address,
        guardian,
        classId,
        observations,
        baptized: baptized || false,
        member: member || false,
        newConvert: newConvert || false,
        photo,
      },
      include: { class: { select: { id: true, name: true } } },
    });

    return NextResponse.json(student, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar aluno:", error);
    return NextResponse.json({ error: "Erro ao criar aluno" }, { status: 500 });
  }
}
