import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

// GET - Listar alunos
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    const userClassId = (session.user as any).classId;

    const { searchParams } = new URL(request.url);
    const queryClassId = searchParams.get("classId");
    const search = searchParams.get("search");
    const includeInactive = searchParams.get("includeInactive") === "true";
    const activeParam = searchParams.get("active");

    // Initialize where object with explicit types for Prisma
    const where: Prisma.StudentWhereInput = {};
    
    // Enforcement: Professors only see their own class
    if (userRole === "PROFESSOR" && userClassId) {
      where.classId = userClassId;
    } else if (queryClassId) {
      where.classId = queryClassId;
    }
    
    // Default filter for only active students
    if (!includeInactive) {
      if (activeParam !== null) {
        where.active = activeParam === "true";
      } else {
        where.active = true;
      }
    }

    if (search) {
      where.name = { contains: search };
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
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    const userClassId = (session.user as any).classId;

    const body = await request.json();
    let {
      name, gender, birthDate, phone, address, guardian,
      classId, observations, baptized, member, newConvert, photo
    } = body;

    // Enforcement: Professors can only create students in their own class
    if (userRole === "PROFESSOR" && userClassId) {
      classId = userClassId;
    }

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
