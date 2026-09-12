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

// GET - Listar alunos
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
    const queryClassId = searchParams.get("classId");
    const search = searchParams.get("search");
    const includeInactive = searchParams.get("includeInactive") === "true";
    const activeParam = searchParams.get("active");

    const where: Prisma.StudentWhereInput = {
      organizationId: activeOrganizationId,
    };

    if (queryClassId) {
      where.classId = queryClassId;
    }

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
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// POST - Criar aluno
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

    const body = rawBody;

    const {
      name, gender, birthDate, phone, address, guardian,
      classId, observations, baptized, member, newConvert, photo
    } = body;

    if (
      typeof name !== "string" ||
      name.trim().length === 0 ||
      typeof classId !== "string" ||
      classId.trim().length === 0
    ) {
      return NextResponse.json({ error: "Nome e classe são obrigatórios" }, { status: 400 });
    }

    const classExists = await prisma.class.findFirst({
      where: { id: classId, organizationId: activeOrganizationId },
    });

    if (!classExists) {
      return NextResponse.json({ error: "Classe não encontrada" }, { status: 404 });
    }

    const student = await prisma.student.create({
      data: {
        name: name.trim(),
        gender: typeof gender === "string" ? gender : null,
        birthDate: typeof birthDate === "string" && birthDate.trim().length > 0 ? new Date(birthDate) : null,
        phone: typeof phone === "string" ? phone : null,
        address: typeof address === "string" ? address : null,
        guardian: typeof guardian === "string" ? guardian : null,
        classId,
        observations: typeof observations === "string" ? observations : null,
        baptized: typeof baptized === "boolean" ? baptized : false,
        member: typeof member === "boolean" ? member : false,
        newConvert: typeof newConvert === "boolean" ? newConvert : false,
        photo: typeof photo === "string" ? photo : null,
        organizationId: activeOrganizationId,
      },
      include: { class: { select: { id: true, name: true } } },
    });

    return NextResponse.json(student, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar aluno:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
