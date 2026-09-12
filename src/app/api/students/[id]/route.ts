import { prisma } from "@/lib/prisma";
import { requireOrganization } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authResult = await requireOrganization(true);
    if ("error" in authResult || !("activeOrganizationId" in authResult)) {
      return NextResponse.json(
        {
          error:
            "error" in authResult
              ? authResult.error
              : "Organização não selecionada",
        },
        {
          status:
            "status" in authResult
              ? authResult.status
              : 403,
        }
      );
    }
    const { activeOrganizationId, orgRole, globalAdminMode } = authResult;

    const allowedRoles = ["ADMIN", "DIRIGENTE", "VICE_DIRIGENTE", "PROFESSOR", "APOIO"];
    const isAllowed =
      globalAdminMode ||
      (orgRole ? allowedRoles.includes(orgRole) : false);

    if (!isAllowed) {
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
    const authResult = await requireOrganization(true);
    if ("error" in authResult || !("activeOrganizationId" in authResult)) {
      return NextResponse.json(
        {
          error:
            "error" in authResult
              ? authResult.error
              : "Organização não selecionada",
        },
        {
          status:
            "status" in authResult
              ? authResult.status
              : 403,
        }
      );
    }
    const { activeOrganizationId, orgRole, globalAdminMode } = authResult;

    const isManager =
      globalAdminMode ||
      (orgRole
        ? ["ADMIN", "DIRIGENTE", "VICE_DIRIGENTE"].includes(orgRole)
        : false);

    if (!isManager) {
      return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 });
    }

    const rawBody: unknown = await request.json();
    if (!isRecord(rawBody) || "organizationId" in rawBody) {
      return NextResponse.json(
        { error: "Payload inválido ou campo organizationId proibido" },
        { status: 400 }
      );
    }

    const body = rawBody;

    const existing = await prisma.student.findFirst({
      where: { id: id, organizationId: activeOrganizationId }
    });
    if (!existing) {
      return NextResponse.json({ error: "Aluno não encontrado" }, { status: 404 });
    }

    const dataToUpdate: {
      name?: string;
      gender?: string | null;
      birthDate?: Date | null;
      phone?: string | null;
      address?: string | null;
      guardian?: string | null;
      classId?: string;
      active?: boolean;
      observations?: string | null;
      baptized?: boolean;
      member?: boolean;
      newConvert?: boolean;
      photo?: string | null;
    } = {};

    let fieldsProvidedCount = 0;

    if ("name" in body) {
      if (typeof body.name !== "string" || body.name.trim().length === 0) {
        return NextResponse.json({ error: "Nome não pode ser vazio" }, { status: 400 });
      }
      dataToUpdate.name = body.name.trim();
      fieldsProvidedCount++;
    }

    if ("gender" in body) {
      dataToUpdate.gender = typeof body.gender === "string" ? body.gender : null;
      fieldsProvidedCount++;
    }

    if ("birthDate" in body) {
      dataToUpdate.birthDate =
        typeof body.birthDate === "string" && body.birthDate.trim().length > 0
          ? new Date(body.birthDate)
          : null;
      fieldsProvidedCount++;
    }

    if ("phone" in body) {
      dataToUpdate.phone = typeof body.phone === "string" ? body.phone : null;
      fieldsProvidedCount++;
    }

    if ("address" in body) {
      dataToUpdate.address = typeof body.address === "string" ? body.address : null;
      fieldsProvidedCount++;
    }

    if ("guardian" in body) {
      dataToUpdate.guardian = typeof body.guardian === "string" ? body.guardian : null;
      fieldsProvidedCount++;
    }

    if ("classId" in body) {
      if (typeof body.classId !== "string" || body.classId.trim().length === 0) {
        return NextResponse.json({ error: "Classe inválida" }, { status: 400 });
      }
      if (body.classId !== existing.classId) {
        const classExists = await prisma.class.findFirst({
          where: { id: body.classId, organizationId: activeOrganizationId }
        });
        if (!classExists) {
          return NextResponse.json({ error: "Nova classe não encontrada" }, { status: 404 });
        }
      }
      dataToUpdate.classId = body.classId;
      fieldsProvidedCount++;
    }

    if ("active" in body) {
      if (typeof body.active === "boolean") {
        dataToUpdate.active = body.active;
        fieldsProvidedCount++;
      } else {
        return NextResponse.json({ error: "Campo active deve ser booleano" }, { status: 400 });
      }
    }

    if ("observations" in body) {
      dataToUpdate.observations = typeof body.observations === "string" ? body.observations : null;
      fieldsProvidedCount++;
    }

    if ("baptized" in body) {
      dataToUpdate.baptized = typeof body.baptized === "boolean" ? body.baptized : false;
      fieldsProvidedCount++;
    }

    if ("member" in body) {
      dataToUpdate.member = typeof body.member === "boolean" ? body.member : false;
      fieldsProvidedCount++;
    }

    if ("newConvert" in body) {
      dataToUpdate.newConvert = typeof body.newConvert === "boolean" ? body.newConvert : false;
      fieldsProvidedCount++;
    }

    if ("photo" in body) {
      dataToUpdate.photo = typeof body.photo === "string" ? body.photo : null;
      fieldsProvidedCount++;
    }

    if (fieldsProvidedCount === 0) {
      return NextResponse.json(
        { error: "Nenhum campo válido para atualização foi fornecido" },
        { status: 400 }
      );
    }

    const updateResult = await prisma.student.updateMany({
      where: { id: id, organizationId: activeOrganizationId },
      data: dataToUpdate,
    });

    if (updateResult.count !== 1) {
      return NextResponse.json({ error: "Aluno não encontrado" }, { status: 404 });
    }

    const updatedStudent = await prisma.student.findFirst({
      where: { id: id, organizationId: activeOrganizationId },
      include: { class: { select: { id: true, name: true } } },
    });

    return NextResponse.json(updatedStudent);
  } catch (error) {
    console.error("Erro ao atualizar aluno:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

class StudentNotFoundError extends Error {
  constructor() {
    super("STUDENT_NOT_FOUND");
    this.name = "StudentNotFoundError";
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authResult = await requireOrganization(true);
    if ("error" in authResult || !("activeOrganizationId" in authResult)) {
      return NextResponse.json(
        {
          error:
            "error" in authResult
              ? authResult.error
              : "Organização não selecionada",
        },
        {
          status:
            "status" in authResult
              ? authResult.status
              : 403,
        }
      );
    }
    const { activeOrganizationId, orgRole, globalAdminMode } = authResult;

    const isManager =
      globalAdminMode ||
      (orgRole
        ? ["ADMIN", "DIRIGENTE", "VICE_DIRIGENTE"].includes(orgRole)
        : false);

    if (!isManager) {
      return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      const existing = await tx.student.findFirst({
        where: { id: id, organizationId: activeOrganizationId },
      });
      if (!existing) {
        throw new StudentNotFoundError();
      }

      await tx.attendanceItem.deleteMany({ where: { studentId: id } });
      await tx.absenceJustification.deleteMany({ where: { studentId: id } });
      await tx.studentVisitorPoint.deleteMany({ where: { studentId: id } });
      await tx.quarterHighlight.deleteMany({ where: { studentId: id } });
      await tx.reward.deleteMany({ where: { studentId: id } });
      await tx.visitor.updateMany({ where: { invitedById: id }, data: { invitedById: null } });

      const deletedCount = await tx.student.deleteMany({
        where: { id: id, organizationId: activeOrganizationId },
      });

      if (deletedCount.count !== 1) {
        throw new StudentNotFoundError();
      }
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof StudentNotFoundError || (error instanceof Error && error.message === "STUDENT_NOT_FOUND")) {
      return NextResponse.json({ error: "Aluno não encontrado" }, { status: 404 });
    }
    console.error("Erro ao excluir aluno:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
