import { prisma } from "@/lib/prisma";
import { requireOrganization } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { AttendanceStatus } from "@prisma/client";

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

const VALID_STATUSES: readonly string[] = ["PRESENTE", "FALTA", "FALTA_JUSTIFICADA"];

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
    const dateStr = searchParams.get("date");

    if (!dateStr) {
      return NextResponse.json({ error: "Data não informada" }, { status: 400 });
    }

    const date = new Date(dateStr + "T00:00:00.000Z");
    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: "Data inválida" }, { status: 400 });
    }

    const attendance = await prisma.leaderAttendance.findMany({
      where: {
        date,
        leader: {
          organizationId: activeOrganizationId,
        },
      },
      select: {
        id: true,
        leaderId: true,
        date: true,
        status: true,
        justification: true,
      },
    });

    return NextResponse.json(attendance);
  } catch (error) {
    console.error("Erro ao buscar presença da liderança:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

interface ParsedLeaderAttendanceItem {
  leaderId: string;
  status: AttendanceStatus;
  justification: string | null;
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

    const { date: dateStr, items } = rawBody;

    if (typeof dateStr !== "string" || dateStr.trim().length === 0) {
      return NextResponse.json({ error: "Data não informada" }, { status: 400 });
    }

    const date = new Date(dateStr.trim() + "T00:00:00.000Z");
    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: "Data inválida" }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Nenhum item de presença enviado" }, { status: 400 });
    }

    const parsedItems: ParsedLeaderAttendanceItem[] = [];
    const leaderIdsList: string[] = [];

    for (const item of items) {
      if (!isRecord(item)) {
        return NextResponse.json({ error: "Item de presença inválido" }, { status: 400 });
      }

      const { leaderId, status, justification } = item;

      if (typeof leaderId !== "string" || leaderId.trim().length === 0) {
        return NextResponse.json({ error: "leaderId é obrigatório em cada item" }, { status: 400 });
      }

      if (typeof status !== "string" || !VALID_STATUSES.includes(status)) {
        return NextResponse.json({ error: "Status de presença inválido" }, { status: 400 });
      }

      const trimmedLeaderId = leaderId.trim();
      leaderIdsList.push(trimmedLeaderId);

      parsedItems.push({
        leaderId: trimmedLeaderId,
        status: status as AttendanceStatus,
        justification: typeof justification === "string" ? justification.trim() : null,
      });
    }

    const uniqueLeaderIds = new Set(leaderIdsList);
    if (uniqueLeaderIds.size !== leaderIdsList.length) {
      return NextResponse.json(
        { error: "Lista de presença contém líderes duplicados" },
        { status: 400 }
      );
    }

    const savedCount = await prisma.$transaction(async (tx) => {
      const existingLeaders = await tx.leader.findMany({
        where: {
          id: { in: Array.from(uniqueLeaderIds) },
          organizationId: activeOrganizationId,
        },
        select: { id: true },
      });

      if (existingLeaders.length !== uniqueLeaderIds.size) {
        throw new LeaderNotFoundError();
      }

      await tx.leaderAttendance.deleteMany({
        where: {
          date,
          leader: {
            organizationId: activeOrganizationId,
          },
        },
      });

      await tx.leaderAttendance.createMany({
        data: parsedItems.map((item) => ({
          leaderId: item.leaderId,
          date,
          status: item.status,
          justification: item.justification,
        })),
      });

      return parsedItems.length;
    });

    return NextResponse.json({ success: true, saved: savedCount });
  } catch (error) {
    if (error instanceof LeaderNotFoundError) {
      return NextResponse.json(
        { error: "Um ou mais líderes não foram encontrados nesta organização" },
        { status: 404 }
      );
    }
    console.error("Erro ao salvar presença da liderança:", error);
    return NextResponse.json(
      { error: "Erro interno ao salvar presença da liderança" },
      { status: 500 }
    );
  }
}
