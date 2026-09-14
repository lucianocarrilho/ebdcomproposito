import { prisma } from "@/lib/prisma";
import { requireOrganization } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

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
      select: { id: true },
    });

    if (!leader) {
      return NextResponse.json({ error: "Líder não encontrado" }, { status: 404 });
    }

    const attendance = await prisma.leaderAttendance.findMany({
      where: {
        leaderId: id,
        leader: { organizationId: activeOrganizationId },
      },
      orderBy: { date: "desc" },
      take: 20,
    });

    return NextResponse.json(attendance);
  } catch (error) {
    console.error("Erro ao buscar histórico do líder:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
