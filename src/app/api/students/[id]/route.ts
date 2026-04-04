import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { AttendanceStatus } from "@prisma/client";

// GET - Buscar aluno por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    const userClassId = (session.user as any).classId;

    const { id } = await params;
    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        class: true,
        attendanceItems: {
          include: { record: { select: { date: true, classId: true } } },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        justifications: { orderBy: { date: "desc" }, take: 10 },
        visitorsInvited: { orderBy: { date: "desc" } },
        quarterHighlights: { orderBy: { date: "desc" } },
        visitorPoints: true,
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Aluno não encontrado" }, { status: 404 });
    }

    // Enforcement: Professors can only see students from their own class
    if (userRole === "PROFESSOR" && userClassId && student.classId !== userClassId) {
      return NextResponse.json({ error: "Acesso negado a este aluno" }, { status: 403 });
    }

    // Calculate attendance stats
    const totalAulas = student.attendanceItems.length;
    const presencas = student.attendanceItems.filter((a: { status: AttendanceStatus }) => a.status === "PRESENTE").length;
    const frequencia = totalAulas > 0 ? Math.round((presencas / totalAulas) * 100) : 0;

    return NextResponse.json({
      ...student,
      stats: {
        totalAulas,
        presencas,
        faltas: student.attendanceItems.filter((a: { status: AttendanceStatus }) => a.status === "FALTA").length,
        justificadas: student.attendanceItems.filter((a: { status: AttendanceStatus }) => a.status === "FALTA_JUSTIFICADA").length,
        frequencia,
        visitantesTrazidos: student.visitorsInvited.length,
        destaques: student.quarterHighlights.length,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar aluno:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// PUT - Atualizar aluno
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    const userClassId = (session.user as any).classId;

    const { id } = await params;

    // Check if professor can access this student
    if (userRole === "PROFESSOR" && userClassId) {
      const student = await prisma.student.findUnique({ where: { id }, select: { classId: true } });
      if (!student || student.classId !== userClassId) {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
      }
    }

    const body = await request.json();
    let {
      name, gender, birthDate, phone, address, guardian,
      classId, observations, baptized, member, newConvert, active, photo
    } = body;

    // Enforcement: Professors cannot change student's class
    if (userRole === "PROFESSOR" && userClassId) {
      classId = userClassId;
    }

    const updated = await prisma.student.update({
      where: { id },
      data: {
        name,
        gender,
        birthDate: birthDate ? new Date(birthDate) : undefined,
        phone,
        address,
        guardian,
        classId,
        observations,
        baptized,
        member,
        newConvert,
        active,
        photo,
      },
      include: { class: { select: { id: true, name: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Erro ao atualizar aluno:", error);
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 });
  }
}

// DELETE - Excluir aluno
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const userRole = (session.user as any).role;
    const userClassId = (session.user as any).classId;

    // Check if professor can access this student
    if (userRole === "PROFESSOR" && userClassId) {
      const student = await prisma.student.findUnique({ where: { id }, select: { classId: true } });
      if (!student || student.classId !== userClassId) {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
      }
    }

    await prisma.student.update({
      where: { id },
      data: { active: false },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir aluno:", error);
    return NextResponse.json({ error: "Erro ao excluir" }, { status: 500 });
  }
}
