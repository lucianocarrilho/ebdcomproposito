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

class LeaderNotFoundError extends Error {
  constructor() {
    super("LEADER_NOT_FOUND");
    this.name = "LeaderNotFoundError";
  }
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

    const leader = await prisma.leader.findFirst({
      where: { id: id, organizationId: activeOrganizationId },
      include: {
        class: { select: { id: true, name: true } },
      },
    });

    if (!leader) {
      return NextResponse.json({ error: "Líder não encontrado" }, { status: 404 });
    }

    return NextResponse.json(leader);
  } catch (error) {
    console.error("Erro ao buscar líder:", error);
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

    const existing = await prisma.leader.findFirst({
      where: { id: id, organizationId: activeOrganizationId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Líder não encontrado" }, { status: 404 });
    }

    const dataToUpdate: {
      name?: string;
      role?: string;
      phone?: string | null;
      email?: string | null;
      classId?: string | null;
      active?: boolean;
      startDate?: Date;
      observations?: string | null;
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

    if ("role" in body) {
      if (typeof body.role !== "string" || body.role.trim().length === 0) {
        return NextResponse.json({ error: "Papel (role) não pode ser vazio" }, { status: 400 });
      }
      dataToUpdate.role = body.role.trim();
      fieldsProvidedCount++;
    }

    if ("phone" in body) {
      dataToUpdate.phone = typeof body.phone === "string" ? body.phone.trim() || null : null;
      fieldsProvidedCount++;
    }

    if ("email" in body) {
      dataToUpdate.email = typeof body.email === "string" ? body.email.trim() || null : null;
      fieldsProvidedCount++;
    }

    if ("classId" in body) {
      if (body.classId === "none" || body.classId === "" || body.classId === null) {
        dataToUpdate.classId = null;
        fieldsProvidedCount++;
      } else if (typeof body.classId === "string" && body.classId.trim().length > 0) {
        const trimmedClassId = body.classId.trim();
        if (trimmedClassId !== existing.classId) {
          const classExists = await prisma.class.findFirst({
            where: { id: trimmedClassId, organizationId: activeOrganizationId },
          });
          if (!classExists) {
            return NextResponse.json({ error: "Nova classe não encontrada" }, { status: 404 });
          }
        }
        dataToUpdate.classId = trimmedClassId;
        fieldsProvidedCount++;
      } else {
        return NextResponse.json({ error: "Classe inválida" }, { status: 400 });
      }
    }

    if ("active" in body) {
      if (typeof body.active === "boolean") {
        dataToUpdate.active = body.active;
        fieldsProvidedCount++;
      } else {
        return NextResponse.json({ error: "Campo active deve ser booleano" }, { status: 400 });
      }
    }

    if ("startDate" in body) {
      if (typeof body.startDate === "string" && body.startDate.trim().length > 0) {
        const parsed = new Date(body.startDate.trim());
        if (isNaN(parsed.getTime())) {
          return NextResponse.json({ error: "Data de início inválida" }, { status: 400 });
        }
        dataToUpdate.startDate = parsed;
        fieldsProvidedCount++;
      } else {
        return NextResponse.json({ error: "Data de início inválida" }, { status: 400 });
      }
    }

    if ("observations" in body) {
      dataToUpdate.observations = typeof body.observations === "string" ? body.observations.trim() || null : null;
      fieldsProvidedCount++;
    }

    if ("photo" in body) {
      dataToUpdate.photo = typeof body.photo === "string" ? body.photo.trim() || null : null;
      fieldsProvidedCount++;
    }

    if (fieldsProvidedCount === 0) {
      return NextResponse.json(
        { error: "Nenhum campo válido para atualização foi fornecido" },
        { status: 400 }
      );
    }

    const updateResult = await prisma.leader.updateMany({
      where: { id: id, organizationId: activeOrganizationId },
      data: dataToUpdate,
    });

    if (updateResult.count !== 1) {
      return NextResponse.json({ error: "Líder não encontrado" }, { status: 404 });
    }

    const updatedLeader = await prisma.leader.findFirst({
      where: { id: id, organizationId: activeOrganizationId },
      include: { class: { select: { id: true, name: true } } },
    });

    return NextResponse.json(updatedLeader);
  } catch (error) {
    console.error("Erro ao atualizar líder:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
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
      const existing = await tx.leader.findFirst({
        where: { id: id, organizationId: activeOrganizationId },
      });
      if (!existing) {
        throw new LeaderNotFoundError();
      }

      await tx.leaderAttendance.deleteMany({
        where: { leaderId: id },
      });

      const deletedCount = await tx.leader.deleteMany({
        where: { id: id, organizationId: activeOrganizationId },
      });

      if (deletedCount.count !== 1) {
        throw new LeaderNotFoundError();
      }
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof LeaderNotFoundError) {
      return NextResponse.json({ error: "Líder não encontrado" }, { status: 404 });
    }
    console.error("Erro ao excluir líder:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
