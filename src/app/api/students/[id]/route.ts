import { prisma } from "@/lib/prisma";
import { requireOrganization } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orgData = await requireOrganization(true);
    if (!orgData || (orgData as any).error) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }
    const { activeOrganizationId, orgRole } = orgData as any;

    const allowedRoles = ["ADMIN", "DIRIGENTE", "VICE_DIRIGENTE", "PROFESSOR", "APOIO"];
    if (!allowedRoles.includes(orgRole)) {
      return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 });
    }

    const student = await prisma.student.findFirst({
      where: { id: id, organizationId: activeOrganizationId },
      include: {
        class: { select: { id: true, name: true } },
        attendanceItems: {
          include: { record: true },
          orderBy: { record: { date: "desc" } },
          take: 10,
        },
        visitorPoints: {
          orderBy: { quarter: "desc" },
        },
        quarterHighlights: {
          orderBy: { date: "desc" },
        },
        rewards: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Aluno não encontrado" }, { status: 404 });
    }

    // Cálculos de estatísticas vitais para o frontend
    const presencas = await prisma.attendanceItem.count({
      where: { studentId: id, status: "PRESENTE" }
    });
    const faltas = await prisma.attendanceItem.count({
      where: { studentId: id, status: "FALTA" }
    });
    const justificadas = await prisma.attendanceItem.count({
      where: { studentId: id, status: "FALTA_JUSTIFICADA" }
    });
    const visitantesTrazidos = await prisma.visitor.count({
      where: { invitedById: id, organizationId: activeOrganizationId }
    });
    const destaques = await prisma.quarterHighlight.count({
      where: { studentId: id, type: "destaque", organizationId: activeOrganizationId }
    });

    const totalAulas = presencas + faltas + justificadas;
    const frequencia = totalAulas > 0 ? Math.round((presencas / totalAulas) * 100) : 0;

    const stats = {
      totalAulas,
      presencas,
      faltas,
      justificadas,
      frequencia,
      visitantesTrazidos,
      destaques
    };

    const visitorsInvited = await prisma.visitor.findMany({
      where: { invitedById: id, organizationId: activeOrganizationId },
      orderBy: { date: "desc" }
    });

    return NextResponse.json({
      ...student,
      stats,
      visitorsInvited
    });
  } catch (error) {
    console.error("Erro ao buscar aluno:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orgData = await requireOrganization(true);
    if (!orgData || (orgData as any).error) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }
    const { activeOrganizationId, orgRole } = orgData as any;

    if (orgRole !== "ADMIN" && orgRole !== "DIRIGENTE") {
      return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 });
    }

    const body = await request.json();
    if ("organizationId" in body) {
      return NextResponse.json({ error: "O campo organizationId não pode ser alterado" }, { status: 400 });
    }

    const existing = await prisma.student.findFirst({
      where: { id: id, organizationId: activeOrganizationId }
    });
    if (!existing) {
      return NextResponse.json({ error: "Aluno não encontrado" }, { status: 404 });
    }

    if (body.classId && body.classId !== existing.classId) {
      const classExists = await prisma.class.findFirst({
        where: { id: body.classId, organizationId: activeOrganizationId }
      });
      if (!classExists) {
        return NextResponse.json({ error: "Nova classe não encontrada" }, { status: 404 });
      }
    }

    const {
      name, gender, birthDate, phone, address, guardian,
      classId, active, observations, baptized, member, newConvert, photo
    } = body;

    const student = await prisma.student.update({
      where: { id: id, organizationId: activeOrganizationId },
      data: {
        name,
        gender,
        birthDate: birthDate ? new Date(birthDate) : null,
        phone,
        address,
        guardian,
        classId,
        active,
        observations,
        baptized,
        member,
        newConvert,
        photo,
      },
      include: { class: { select: { id: true, name: true } } },
    });

    return NextResponse.json(student);
  } catch (error) {
    console.error("Erro ao atualizar aluno:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orgData = await requireOrganization(true);
    if (!orgData || (orgData as any).error) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }
    const { activeOrganizationId, orgRole } = orgData as any;

    if (orgRole !== "ADMIN" && orgRole !== "DIRIGENTE") {
      return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 });
    }

    const existing = await prisma.student.findFirst({
      where: { id: id, organizationId: activeOrganizationId }
    });
    if (!existing) {
      return NextResponse.json({ error: "Aluno não encontrado" }, { status: 404 });
    }

    await prisma.student.delete({
      where: { id: id, organizationId: activeOrganizationId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir aluno:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
