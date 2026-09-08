import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrganization } from "@/lib/permissions";

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

// GET - Listar visitantes da organização ativa e ranking de indicações
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
    const { activeOrganizationId } = authResult;

    const visitors = await prisma.visitor.findMany({
      where: {
        organizationId: activeOrganizationId,
      },
      include: {
        class: true,
        invitedBy: { select: { id: true, name: true, photo: true } },
      },
      orderBy: { date: "desc" },
    });

    const rankingRaw = await prisma.visitor.groupBy({
      by: ["invitedById"],
      _count: {
        id: true,
      },
      where: {
        organizationId: activeOrganizationId,
        invitedById: { not: null },
      },
      orderBy: {
        _count: {
          id: "desc",
        },
      },
      take: 5,
    });

    const ranking = await Promise.all(
      rankingRaw.map(async (item) => {
        if (!item.invitedById) return null;
        const student = await prisma.student.findFirst({
          where: {
            id: item.invitedById,
            organizationId: activeOrganizationId,
          },
          include: { class: true },
        });
        return {
          nome: student?.name || "Desconhecido",
          visitantes: item._count.id,
          classe: student?.class?.name || "—",
          mimoEntregue: false,
        };
      })
    );

    return NextResponse.json({
      visitors,
      ranking: ranking.filter((r): r is NonNullable<typeof r> => r !== null),
    });
  } catch (error) {
    console.error("Error fetching visitors:", error);
    return NextResponse.json({ error: "Erro ao carregar visitantes" }, { status: 500 });
  }
}

// POST - Criar visitante na organização ativa
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
    const { activeOrganizationId } = authResult;

    const rawBody: unknown = await request.json();

    if (!isRecord(rawBody) || "organizationId" in rawBody) {
      return NextResponse.json(
        { error: "Payload inválido ou campo organizationId proibido" },
        { status: 400 }
      );
    }

    const body = rawBody;

    const { name, date, classId, invitedById, observations } = body;

    if (
      typeof name !== "string" ||
      name.trim().length === 0 ||
      typeof date !== "string" ||
      date.trim().length === 0 ||
      typeof classId !== "string" ||
      classId.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "Nome, data e classe são obrigatórios" },
        { status: 400 }
      );
    }

    const parsedDate = new Date(date.includes("T") ? date : date + "T12:00:00.000Z");
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "Data inválida" }, { status: 400 });
    }

    if (invitedById !== undefined && invitedById !== null && typeof invitedById !== "string") {
      return NextResponse.json({ error: "Aluno indicador inválido" }, { status: 400 });
    }

    if (observations !== undefined && observations !== null && typeof observations !== "string") {
      return NextResponse.json({ error: "Observações inválidas" }, { status: 400 });
    }

    // Validar se a classe pertence à organização ativa
    const classExists = await prisma.class.findFirst({
      where: { id: classId, organizationId: activeOrganizationId },
    });
    if (!classExists) {
      return NextResponse.json({ error: "Classe não encontrada" }, { status: 404 });
    }

    // Validar se o aluno indicador pertence à organização ativa
    let targetInvitedById: string | null = null;
    if (
      typeof invitedById === "string" &&
      invitedById.trim().length > 0 &&
      invitedById !== "none"
    ) {
      targetInvitedById = invitedById;
      const studentExists = await prisma.student.findFirst({
        where: { id: targetInvitedById, organizationId: activeOrganizationId },
      });
      if (!studentExists) {
        return NextResponse.json({ error: "Aluno indicador não encontrado" }, { status: 404 });
      }
    }

    const visitor = await prisma.visitor.create({
      data: {
        name: name.trim(),
        date: parsedDate,
        classId,
        invitedById: targetInvitedById,
        observations: typeof observations === "string" ? observations : null,
        organizationId: activeOrganizationId,
      },
      include: {
        class: true,
        invitedBy: true,
      },
    });

    return NextResponse.json(visitor, { status: 201 });
  } catch (error) {
    console.error("Error creating visitor:", error);
    return NextResponse.json({ error: "Erro ao registrar visitante" }, { status: 500 });
  }
}
