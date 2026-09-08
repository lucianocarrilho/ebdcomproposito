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

// PUT - Editar visitante na organização ativa
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
      return NextResponse.json(
        { error: "Permissão insuficiente" },
        { status: 403 }
      );
    }

    const rawBody: unknown = await request.json();
    if (!isRecord(rawBody) || "organizationId" in rawBody) {
      return NextResponse.json(
        { error: "Payload inválido ou campo organizationId proibido" },
        { status: 400 }
      );
    }

    const body = rawBody;

    // 1. Confirmar existência prévia na organização ativa
    const existing = await prisma.visitor.findFirst({
      where: {
        id,
        organizationId: activeOrganizationId,
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Visitante não encontrado" }, { status: 404 });
    }

    const dataToUpdate: {
      name?: string;
      date?: Date;
      classId?: string;
      invitedById?: string | null;
      observations?: string | null;
    } = {};

    let fieldsProvidedCount = 0;

    if ("name" in body) {
      if (typeof body.name !== "string" || body.name.trim().length === 0) {
        return NextResponse.json({ error: "Nome não pode ser vazio" }, { status: 400 });
      }
      dataToUpdate.name = body.name.trim();
      fieldsProvidedCount++;
    }

    if ("date" in body) {
      if (typeof body.date !== "string" || body.date.trim().length === 0) {
        return NextResponse.json({ error: "Data inválida" }, { status: 400 });
      }
      const parsedDate = new Date(body.date.includes("T") ? body.date : body.date + "T12:00:00.000Z");
      if (isNaN(parsedDate.getTime())) {
        return NextResponse.json({ error: "Data inválida" }, { status: 400 });
      }
      dataToUpdate.date = parsedDate;
      fieldsProvidedCount++;
    }

    if ("classId" in body) {
      if (typeof body.classId !== "string" || body.classId.trim().length === 0) {
        return NextResponse.json({ error: "Classe inválida" }, { status: 400 });
      }
      if (body.classId !== existing.classId) {
        const classExists = await prisma.class.findFirst({
          where: { id: body.classId, organizationId: activeOrganizationId },
        });
        if (!classExists) {
          return NextResponse.json({ error: "Nova classe não encontrada" }, { status: 404 });
        }
      }
      dataToUpdate.classId = body.classId;
      fieldsProvidedCount++;
    }

    if ("invitedById" in body) {
      const rawInvited = body.invitedById;
      if (rawInvited === null || rawInvited === "" || rawInvited === "none") {
        dataToUpdate.invitedById = null;
      } else if (typeof rawInvited === "string" && rawInvited.trim().length > 0) {
        if (rawInvited !== existing.invitedById) {
          const studentExists = await prisma.student.findFirst({
            where: { id: rawInvited, organizationId: activeOrganizationId },
          });
          if (!studentExists) {
            return NextResponse.json({ error: "Novo aluno indicador não encontrado" }, { status: 404 });
          }
        }
        dataToUpdate.invitedById = rawInvited;
      } else {
        return NextResponse.json({ error: "Aluno indicador inválido" }, { status: 400 });
      }
      fieldsProvidedCount++;
    }

    if ("observations" in body) {
      if (body.observations === null || body.observations === "") {
        dataToUpdate.observations = null;
      } else if (typeof body.observations === "string") {
        dataToUpdate.observations = body.observations;
      } else {
        return NextResponse.json({ error: "Observações inválidas" }, { status: 400 });
      }
      fieldsProvidedCount++;
    }

    if (fieldsProvidedCount === 0) {
      return NextResponse.json(
        { error: "Nenhum campo válido para atualização foi fornecido" },
        { status: 400 }
      );
    }

    // Mutação final filtrada por ID e escopo de organização no próprio comando
    const updateResult = await prisma.visitor.updateMany({
      where: {
        id,
        organizationId: activeOrganizationId,
      },
      data: dataToUpdate,
    });

    if (updateResult.count !== 1) {
      return NextResponse.json({ error: "Visitante não encontrado" }, { status: 404 });
    }

    const updatedVisitor = await prisma.visitor.findFirst({
      where: {
        id,
        organizationId: activeOrganizationId,
      },
      include: {
        class: true,
        invitedBy: true,
      },
    });

    return NextResponse.json(updatedVisitor);
  } catch (error) {
    console.error("Erro ao editar visitante:", error);
    return NextResponse.json({ error: "Erro ao editar visitante" }, { status: 500 });
  }
}

// DELETE - Excluir visitante na organização ativa
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
      return NextResponse.json(
        { error: "Permissão insuficiente" },
        { status: 403 }
      );
    }

    const deleteResult = await prisma.visitor.deleteMany({
      where: {
        id,
        organizationId: activeOrganizationId,
      },
    });

    if (deleteResult.count !== 1) {
      return NextResponse.json({ error: "Visitante não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir visitante:", error);
    return NextResponse.json({ error: "Erro ao excluir visitante" }, { status: 500 });
  }
}
