import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { AttendanceStatus } from "@prisma/client";

// GET - Buscar aluno por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
    const { id } = await params;
    const body = await request.json();
    const {
      name, gender, birthDate, phone, address, guardian,
      classId, observations, baptized, member, newConvert, active, photo
    } = body;

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
    const { id } = await params;
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
