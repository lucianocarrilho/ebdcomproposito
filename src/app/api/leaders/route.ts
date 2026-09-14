import { prisma } from "@/lib/prisma";
import { requireOrganization } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export async function GET(request: NextRequest) {
  try {
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

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const activeParam = searchParams.get("active");

    const where: Prisma.LeaderWhereInput = {
      organizationId: activeOrganizationId,
    };

    if (activeParam !== null) {
      where.active = activeParam === "true";
    }

    if (search && search.trim().length > 0) {
      where.name = { contains: search.trim() };
    }

    const leaders = await prisma.leader.findMany({
      where,
      include: { class: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(leaders);
  } catch (error) {
    console.error("Erro ao buscar líderes:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
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

    const { name, role, phone, email, classId, startDate, observations, photo, active } = rawBody;

    if (
      typeof name !== "string" ||
      name.trim().length === 0 ||
      typeof role !== "string" ||
      role.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "Nome e papel (role) são obrigatórios" },
        { status: 400 }
      );
    }

    let finalClassId: string | null = null;
    if (typeof classId === "string" && classId.trim().length > 0 && classId.trim() !== "none") {
      const classExists = await prisma.class.findFirst({
        where: { id: classId.trim(), organizationId: activeOrganizationId },
      });
      if (!classExists) {
        return NextResponse.json({ error: "Classe não encontrada" }, { status: 404 });
      }
      finalClassId = classId.trim();
    }

    let parsedStartDate = new Date();
    if (typeof startDate === "string" && startDate.trim().length > 0) {
      const parsed = new Date(startDate.trim());
      if (isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "Data de início inválida" }, { status: 400 });
      }
      parsedStartDate = parsed;
    }

    const leader = await prisma.leader.create({
      data: {
        name: name.trim(),
        role: role.trim(),
        phone: typeof phone === "string" ? phone.trim() || null : null,
        email: typeof email === "string" ? email.trim() || null : null,
        classId: finalClassId,
        startDate: parsedStartDate,
        observations: typeof observations === "string" ? observations.trim() || null : null,
        photo: typeof photo === "string" ? photo.trim() || null : null,
        active: typeof active === "boolean" ? active : true,
        organizationId: activeOrganizationId,
      },
      include: { class: { select: { id: true, name: true } } },
    });

    return NextResponse.json(leader, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar líder:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
